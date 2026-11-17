// Die Website: öffentliche Profile, Mitgliederliste, Login über Bot-Link, Editor & API.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from '../config.js';
import { sanitizeProfile, validateSlug, displayNameOf } from '../shared/profile.js';
import { renderActivity } from '../shared/render.js';
import { securityHeaders, parseCookies, requireSameOrigin, rateLimit } from './security.js';
import * as pages from './pages.js';
import { editorPage } from './editor-page.js';
import { processImage, ImageError, enqueue } from './images.js';

export const SESSION_COOKIE = 'sid';
const SNAPSHOT_TTL = 10 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** Hält die Discord-Daten (Avatar, Rollen, …) frisch – mit Cache & ohne doppelte Anfragen. */
export function createSnapshotService({ store, discord, log, ttlMs = SNAPSHOT_TTL }) {
  const inflight = new Map();

  function refresh(userId) {
    if (inflight.has(userId)) return inflight.get(userId);
    const job = (async () => {
      try {
        const snap = await discord.fetchMember(userId);
        if (snap) store.putDiscord(userId, snap);
        return snap ?? store.getDiscord(userId);
      } catch (err) {
        log.warn(`Discord-Daten für ${userId} nicht aktualisiert: ${err.message}`);
        return store.getDiscord(userId);
      } finally {
        inflight.delete(userId);
      }
    })();
    inflight.set(userId, job);
    return job;
  }

  async function get(userId, { wait = false, force = false } = {}) {
    const snap = store.getDiscord(userId);
    const stale = force || !snap || Date.now() - (snap.syncedAt ?? 0) > ttlMs;
    if (!stale) return snap;
    const job = refresh(userId);
    if (!wait && snap) return snap;
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve(snap), 4000);
    });
    try {
      return await Promise.race([job, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  return { get, refresh };
}

/** Löscht Bilder, die von keinem Profil mehr benutzt werden. */
export function collectUploadGarbage({ store, log, graceMs = 6 * HOUR, now = Date.now() }) {
  const referenced = new Set();
  for (const p of store.listProfiles()) {
    for (const url of [p.theme.bgImage, p.theme.bannerImage]) if (url) referenced.add(path.basename(url));
  }
  let removed = 0;
  for (const [name, meta] of store.allUploads()) {
    if (referenced.has(name) || now - (meta.createdAt ?? 0) < graceMs) continue;
    fs.rmSync(path.join(store.uploadDir, name), { force: true });
    store.removeUpload(name);
    removed++;
  }
  // Dateien ohne Eintrag (z. B. nach Absturz beim Hochladen)
  for (const file of fs.readdirSync(store.uploadDir)) {
    if (store.getUpload(file) || referenced.has(file)) continue;
    const full = path.join(store.uploadDir, file);
    const stat = fs.statSync(full);
    if (stat.isFile() && now - stat.mtimeMs > graceMs) {
      fs.rmSync(full, { force: true });
      removed++;
    }
  }
  if (removed) log.info(`🧹 ${removed} ungenutzte Bilder gelöscht`);
  return removed;
}

export function isPublic(profile, snap) {
  return profile.published && !profile.hidden && snap?.inGuild !== false;
}

/**
 * @param {object} deps
 * @param {ReturnType<import('../config.js').loadConfig>} deps.config
 * @param {import('../store.js').Store} deps.store
 * @param {{ ready: boolean, guild(): any, fetchMember(id: string): Promise<any>, presence(id: string): any }} deps.discord
 * @param {Console} deps.log
 * @param {(app: express.Express, ctx: object) => void} [deps.extraRoutes]
 * @param {ReturnType<typeof createSnapshotService>} [deps.snapshots]
 */
export function createApp({ config, store, discord, log, extraRoutes, snapshots = createSnapshotService({ store, discord, log }) }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(securityHeaders(config));

  const sameOrigin = requireSameOrigin(config);
  const site = () => {
    const g = discord.guild() ?? store.getMeta('guild');
    return { name: config.siteName || g?.name || 'Server-Profile', iconUrl: g?.iconUrl ?? '', memberCount: g?.memberCount ?? null };
  };
  const profileUrl = (p) => `${config.publicUrl}/${p.slug}`;
  const sendMessage = (res, status, opts) => res.status(status).send(pages.messagePage({ site: site(), ...opts }));

  // ------------------------------------------------------------ statische Dateien
  app.use('/static', express.static(path.join(ROOT, 'public'), {
    index: false,
    setHeaders(res, file) {
      if (file.includes(`${path.sep}fonts${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      else res.setHeader('Cache-Control', 'no-cache');
    },
  }));
  app.use('/shared', express.static(path.join(ROOT, 'src/shared'), {
    index: false,
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
  }));
  app.use('/uploads', express.static(store.uploadDir, {
    index: false,
    dotfiles: 'deny',
    setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'),
  }));

  // ------------------------------------------------------------ Sitzung aus Cookie
  app.use((req, res, next) => {
    const sid = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    const session = sid ? store.getSession(sid) : null;
    req.sid = session ? sid : null;
    req.userId = session ? session.userId : null;
    next();
  });

  const setSessionCookie = (res, sid) =>
    res.cookie(SESSION_COOKIE, sid, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.secureCookies,
      maxAge: config.sessionDays * 24 * HOUR,
      path: '/',
    });
  const clearSessionCookie = (res) => res.clearCookie(SESSION_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax', secure: config.secureCookies });

  // ------------------------------------------------------------ Kleinkram
  app.get('/healthz', (req, res) => res.json({ ok: true, discord: discord.ready }));
  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(config.allowIndexing
      ? 'User-agent: *\nDisallow: /edit\nDisallow: /login\nDisallow: /api/\n'
      : 'User-agent: *\nDisallow: /\n');
  });
  app.get('/favicon.ico', (req, res) => res.redirect(301, '/static/favicon.svg'));

  // ------------------------------------------------------------ Mitgliederliste
  app.get('/', (req, res) => {
    const entries = [];
    let refreshBudget = 4;
    for (const profile of store.listProfiles()) {
      const snap = store.getDiscord(profile.userId);
      if (!isPublic(profile, snap) || !profile.listed) continue;
      if (refreshBudget > 0 && (!snap || Date.now() - (snap.syncedAt ?? 0) > SNAPSHOT_TTL)) {
        refreshBudget--;
        snapshots.get(profile.userId); // im Hintergrund auffrischen
      }
      entries.push({ profile, discord: snap });
    }
    entries.sort((a, b) => b.profile.updatedAt - a.profile.updatedAt);
    const me = req.userId ? store.getProfile(req.userId) : null;
    res.send(pages.directoryPage({ site: site(), entries, me }));
  });

  // ------------------------------------------------------------ Login über Bot-Link
  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
  app.get('/login', loginLimiter, (req, res) => {
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const info = token ? store.peekLoginToken(token) : null;
    const profile = info ? store.getProfile(info.userId) : null;
    if (!info || !profile) {
      return sendMessage(res, 400, {
        title: 'Link abgelaufen',
        emoji: '⌛',
        html: 'Dieser Login-Link ist ungültig, schon benutzt oder abgelaufen.<br>Hol dir im Discord mit <code>/profil bearbeiten</code> einfach einen neuen.',
        actions: [{ label: 'Zur Startseite', href: '/' }],
      });
    }
    const snap = store.getDiscord(info.userId);
    res.send(pages.loginPage({
      site: site(),
      token,
      name: displayNameOf(profile, snap),
      avatar: snap?.avatar,
      minutesLeft: Math.max(1, Math.round((info.expiresAt - Date.now()) / 60000)),
    }));
  });

  app.post('/login', loginLimiter, sameOrigin, express.urlencoded({ extended: false, limit: '2kb' }), (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const userId = store.consumeLoginToken(String(req.body?.token ?? ''));
    if (!userId || !store.getProfile(userId)) {
      return sendMessage(res, 400, {
        title: 'Link abgelaufen',
        emoji: '⌛',
        html: 'Dieser Login-Link wurde schon benutzt oder ist abgelaufen. Hol dir im Discord mit <code>/profil bearbeiten</code> einen neuen.',
      });
    }
    if (req.sid) store.deleteSession(req.sid);
    setSessionCookie(res, store.createSession(userId, config.sessionDays * 24 * HOUR));
    res.redirect(303, '/edit');
  });

  app.post('/logout', sameOrigin, (req, res) => {
    if (req.sid) store.deleteSession(req.sid);
    clearSessionCookie(res);
    res.redirect(303, '/');
  });

  // ------------------------------------------------------------ Editor
  app.get('/edit', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const profile = req.userId ? store.getProfile(req.userId) : null;
    if (!profile) {
      if (req.sid) clearSessionCookie(res);
      return sendMessage(res, 401, {
        title: 'Nicht angemeldet',
        emoji: '🔑',
        html: 'Den Editor öffnest du über Discord: Schreib im Server <code>/profil bearbeiten</code> – der Bot schickt dir einen privaten Login-Link.',
        actions: [{ label: 'Zur Startseite', href: '/' }],
      });
    }
    const snap = await snapshots.get(req.userId, { wait: true });
    res.send(editorPage({
      site: site(),
      profile,
      discord: snap,
      presence: discord.presence(req.userId),
      publicUrl: config.publicUrl,
      maxUploadMb: config.maxUploadMb,
      demo: config.demo,
    }));
  });

  app.get('/edit/preview', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.send(pages.previewFramePage());
  });

  // ------------------------------------------------------------ API
  const api = express.Router();
  api.use(sameOrigin);
  api.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  const auth = (req, res, next) => {
    if (req.userId && store.getProfile(req.userId)) return next();
    res.status(401).json({ error: 'Nicht (mehr) angemeldet – öffne den Editor neu über /profil bearbeiten im Discord.' });
  };
  const byUser = (req) => req.userId ?? req.ip;

  api.get('/me', auth, async (req, res) => {
    const profile = store.getProfile(req.userId);
    res.json({
      profile,
      discord: await snapshots.get(req.userId, { wait: true }),
      presence: discord.presence(req.userId),
      url: profileUrl(profile),
    });
  });

  api.put('/me/profile', auth, rateLimit({ windowMs: 60_000, max: 30, key: byUser }), express.json({ limit: '64kb' }), (req, res) => {
    const current = store.getProfile(req.userId);
    const next = sanitizeProfile(req.body?.profile, current);

    if (next.slug !== current.slug) {
      const error = validateSlug(next.slug) ?? (store.isSlugTaken(next.slug, req.userId) ? 'Diese Adresse ist schon vergeben.' : null);
      if (error) return res.status(422).json({ error, field: 'slug' });
    }
    // Nur eigene Uploads dürfen benutzt werden
    for (const key of ['bgImage', 'bannerImage']) {
      const url = next.theme[key];
      if (!url || url === current.theme[key]) continue;
      const upload = store.getUpload(path.basename(url));
      if (!upload || upload.owner !== req.userId) next.theme[key] = current.theme[key];
    }
    if (next.theme.bgType === 'image' && !next.theme.bgImage) next.theme.bgType = 'gradient';
    if (next.theme.banner === 'image' && !next.theme.bannerImage) next.theme.banner = 'discord';

    next.updatedAt = Date.now();
    store.putProfile(next);
    res.json({ profile: next, url: profileUrl(next) });
  });

  api.get('/slug', auth, rateLimit({ windowMs: 60_000, max: 60, key: byUser }), (req, res) => {
    const slug = String(req.query.slug ?? '').trim().toLowerCase();
    const error = validateSlug(slug) ?? (store.isSlugTaken(slug, req.userId) ? 'Schon vergeben – probier eine andere.' : null);
    res.json({ slug, available: !error, error });
  });

  api.post(
    '/me/upload',
    auth,
    rateLimit({ windowMs: HOUR, max: 40, key: byUser, message: 'Zu viele Uploads – probier es in einer Stunde nochmal.' }),
    express.raw({ type: () => true, limit: `${config.maxUploadMb}mb` }),
    async (req, res) => {
      const kind = req.query.kind === 'banner' ? 'banner' : 'background';
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'Keine Datei empfangen.' });
      try {
        const img = await enqueue(() => processImage(req.body, kind));
        const name = `${crypto.randomBytes(12).toString('hex')}.webp`;
        await fs.promises.writeFile(path.join(store.uploadDir, name), img.data);
        store.addUpload(name, { owner: req.userId, kind, bytes: img.data.length, createdAt: Date.now() });
        res.json({ url: `/uploads/${name}`, width: img.width, height: img.height, animated: img.animated });
      } catch (err) {
        if (err instanceof ImageError) return res.status(422).json({ error: err.message });
        throw err;
      }
    },
  );

  api.post('/me/refresh', auth, rateLimit({ windowMs: 60_000, max: 5, key: byUser }), async (req, res) => {
    const snap = await snapshots.get(req.userId, { wait: true, force: true });
    res.json({ discord: snap, presence: discord.presence(req.userId) });
  });

  api.delete('/me', auth, (req, res) => {
    const uploads = store.deleteProfile(req.userId);
    for (const name of uploads) fs.rmSync(path.join(store.uploadDir, name), { force: true });
    log.info(`🗑️  Profil von ${req.userId} wurde vom Nutzer gelöscht`);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // Live-Status für die Profilseite (alle 30 s abgefragt)
  api.get('/live/:userId', rateLimit({ windowMs: 60_000, max: 120 }), (req, res) => {
    const profile = store.getProfile(req.params.userId);
    if (!profile || !isPublic(profile, store.getDiscord(profile.userId))) return res.status(404).json({ error: 'Nicht gefunden' });
    const presence = discord.presence(profile.userId);
    res.json({
      status: profile.show.status ? presence?.status ?? null : null,
      activityHtml: profile.show.activity ? renderActivity(presence) : '',
    });
  });

  app.use('/api', api);
  app.use('/api', (req, res) => res.status(404).json({ error: 'Unbekannter API-Pfad' }));

  extraRoutes?.(app, { store, discord, snapshots, setSessionCookie, site, sameOrigin });

  // ------------------------------------------------------------ Öffentliche Profile
  app.get('/u/:id', (req, res, next) => {
    const profile = store.getProfile(req.params.id);
    if (!profile) return next();
    if (req.userId !== profile.userId && !isPublic(profile, store.getDiscord(profile.userId))) return next();
    res.redirect(302, `/${encodeURIComponent(profile.slug)}`);
  });

  const viewCounter = createViewCounter(store);
  app.get('/:slug', async (req, res, next) => {
    const profile = store.getProfileBySlug(req.params.slug);
    if (!profile) return next();
    if (req.params.slug !== profile.slug) return res.redirect(301, `/${encodeURIComponent(profile.slug)}`);
    const isOwner = req.userId === profile.userId;
    let snap = store.getDiscord(profile.userId);
    if (!isOwner && !isPublic(profile, snap)) return next();

    snap = await snapshots.get(profile.userId, { wait: !snap });
    if (!isOwner && snap?.inGuild === false) return next();

    let notice = '';
    if (isOwner && profile.hidden) notice = 'Dein Profil wurde von der Moderation ausgeblendet – nur du siehst es.';
    else if (isOwner && !profile.published) notice = 'Dein Profil ist privat – nur du siehst es.';
    if (!isOwner) viewCounter(req, profile);

    res.setHeader('Cache-Control', 'no-cache');
    res.send(pages.profilePage({
      profile,
      discord: snap ?? {},
      presence: discord.presence(profile.userId),
      site: site(),
      publicUrl: config.publicUrl,
      notice,
    }));
  });

  // ------------------------------------------------------------ 404 & Fehler
  app.use((req, res) => {
    sendMessage(res, 404, {
      title: 'Nicht gefunden',
      emoji: '👻',
      html: 'Hier ist (noch) nichts. Vielleicht hat die Person ihr Profil umbenannt, privat gestellt oder gelöscht.',
      actions: [{ label: 'Alle Profile ansehen', href: '/', primary: true }],
    });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: `Die Datei ist zu groß (max. ${config.maxUploadMb} MB).` });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Ungültige Daten gesendet.' });
    log.error(`Fehler bei ${req.method} ${req.originalUrl}:`, err);
    if (req.originalUrl.startsWith('/api')) return res.status(500).json({ error: 'Da ist was schiefgelaufen. Versuch es gleich nochmal.' });
    sendMessage(res, 500, { title: 'Ups', emoji: '💥', html: 'Da ist was schiefgelaufen. Versuch es gleich nochmal.' });
  });

  return { app, snapshots, site };
}

/** Zählt Aufrufe – ohne IPs zu speichern: nur ein täglich wechselnder Hash im Arbeitsspeicher. */
function createViewCounter(store) {
  let salt = crypto.randomBytes(16).toString('hex');
  let seen = new Set();
  const timer = setInterval(() => {
    salt = crypto.randomBytes(16).toString('hex');
    seen = new Set();
  }, 24 * HOUR);
  timer.unref?.();
  const BOT_UA = /bot|crawl|spider|slurp|preview|embed|facebookexternalhit|whatsapp|telegram|discord|curl|wget|python|node-fetch|headless/i;

  return (req, profile) => {
    const ua = req.get('user-agent') ?? '';
    if (!ua || BOT_UA.test(ua)) return;
    if (/prefetch|prerender/i.test(req.get('sec-purpose') ?? req.get('purpose') ?? '')) return;
    const key = crypto.createHash('sha256').update(`${salt}|${req.ip}|${ua}|${profile.userId}`).digest('base64url');
    if (seen.has(key)) return;
    if (seen.size > 200_000) seen.clear();
    seen.add(key);
    store.addView(profile.userId);
  };
}
