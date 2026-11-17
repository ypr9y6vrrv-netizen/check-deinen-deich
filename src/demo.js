// Demo-Modus: Website ohne echten Discord-Bot ausprobieren (npm run demo).
// Legt ein paar Beispiel-Profile an und simuliert die Discord-Daten.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import sharp from 'sharp';
import { defaultProfile, defaultTheme, sanitizeProfile, todayKey } from './shared/profile.js';
import { esc } from './shared/render.js';
import * as pages from './web/pages.js';

const DAY = 24 * 60 * 60 * 1000;
const ago = (days) => new Date(Date.now() - days * DAY).toISOString();
const role = (name, color, emoji = null) => ({ id: name, name, color, icon: null, emoji });

const GUILD = { id: '100000000000000000', name: 'Check deinen Deich', iconUrl: '/static/demo/server.svg', memberCount: 128 };
const TAG = { tag: 'DEICH', badge: null };

const USERS = [
  {
    id: '100000000000000001',
    discord: {
      username: 'luna.exe', globalName: 'Luna', displayName: 'Luna', avatar: '/static/demo/luna.svg',
      roles: [role('Admin', '#ef4444', '🛡️'), role('Künstlerin', '#ec4899', '🎨'), role('Valorant', '#fb7185'), role('Nachtschicht', '#8b5cf6')],
      joinedAt: ago(610), createdAt: ago(2100), boostingSince: ago(200), guildTag: TAG,
    },
    presence: {
      status: 'online',
      custom: { text: 'zeichnet gerade ✏️', emoji: null },
      activity: { type: 'listening', name: 'Spotify', details: 'Snowfall', state: 'øneheart, reidenshi', image: null, startedAt: Date.now() - 3 * 60000 },
    },
    profile: {
      tagline: 'Nachteule 🦉 · zeichnet & zockt',
      bio: 'Hey, ich bin Luna! Ich zeichne viel digital (meistens Fanart), spiele Valorant mit den Leuten hier und bin quasi immer nachts online.\n\nSchreib mich gern an, wenn du eine Runde zocken willst 💜',
      pronouns: 'sie/ihr', location: 'Essen, NRW', birthday: '03-14',
      tags: ['Digital Art', 'Valorant', 'Lo-Fi', 'Katzen', 'Anime'],
      fields: [{ label: 'Main', value: 'Jett' }, { label: 'Rang', value: 'Platin 2' }],
      links: [
        { url: 'https://www.instagram.com/', label: 'Meine Zeichnungen' },
        { url: 'https://www.tiktok.com/', label: '' },
        { url: 'https://www.twitch.tv/', label: 'Live-Zeichnen' },
      ],
      song: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
      theme: { preset: 'midnight', effect: 'stars', nameEffect: 'glow', typewriter: true },
    },
  },
  {
    id: '100000000000000002',
    discord: {
      username: 'deichgraf', globalName: 'Deichgraf', displayName: 'Deichgraf 🌊', avatar: '/static/demo/deichgraf.svg',
      roles: [role('Owner', '#f59e0b', '👑'), role('Admin', '#ef4444', '🛡️'), role('Minecraft', '#22c55e')],
      joinedAt: ago(900), createdAt: ago(3300), boostingSince: null, guildTag: TAG,
    },
    presence: { status: 'dnd', custom: null, activity: { type: 'playing', name: 'Minecraft', details: 'Baut am Server-Deich', state: 'Survival', image: null, startedAt: Date.now() - 47 * 60000 } },
    profile: {
      tagline: 'Hat den Server gegründet. Check deinen Deich.',
      bio: 'Owner von dem Laden hier. Wenn was kaputt ist: Ticket aufmachen, nicht DM 😄\nSonst baue ich in Minecraft seit Jahren an einem viel zu großen Deich.',
      pronouns: 'er/ihm', location: 'Irgendwo an der Nordsee',
      tags: ['Minecraft', 'Server-Admin', 'Nordsee'],
      fields: [{ label: 'Lieblings-Block', value: 'Prismarin' }],
      links: [
        { url: 'https://www.youtube.com/', label: 'Deich-Timelapses' },
        { url: 'https://steamcommunity.com/', label: '' },
        { url: 'https://discord.gg/example', label: 'Unser Server' },
      ],
      theme: { preset: 'ocean', effect: 'rain', nameEffect: 'shine', banner: 'accent', cardStyle: 'solid' },
    },
  },
  {
    id: '100000000000000003',
    discord: {
      username: 'kai_fps', globalName: 'Kai', displayName: 'Kai', avatar: '/static/demo/kai.svg',
      roles: [role('CS2', '#f97316', '🎯'), role('Turnier-Team', '#06b6d4')],
      joinedAt: ago(140), createdAt: ago(1500), boostingSince: ago(30), guildTag: null,
    },
    presence: { status: 'idle', custom: null, activity: { type: 'playing', name: 'Counter-Strike 2', details: 'Premier · Mirage', state: '9 : 6', image: null, startedAt: Date.now() - 18 * 60000 } },
    profile: {
      tagline: 'CS2 · FACEIT Level 10 · nur noch eine Runde',
      bio: 'Entry-Fragger. Trainiere jeden Tag Aim, meistens mit Musik zu laut.',
      pronouns: 'er/ihm',
      tags: ['CS2', 'Aim-Training', 'Hardware'],
      fields: [{ label: 'Setup', value: 'PC · 360 Hz' }, { label: 'Maus', value: 'Viper V3 Pro' }, { label: 'Sens', value: '1.1 @ 400 DPI' }],
      links: [
        { url: 'https://steamcommunity.com/', label: '' },
        { url: 'https://www.faceit.com/', label: '' },
        { url: 'https://www.twitch.tv/', label: '' },
        { url: 'https://www.youtube.com/', label: '' },
        { url: 'https://x.com/', label: '' },
      ],
      theme: { preset: 'neon', effect: 'matrix', nameEffect: 'glitch', font: 'futur', linkStyle: 'icons', cardStyle: 'neon', banner: 'none' },
    },
  },
  {
    id: '100000000000000004',
    discord: {
      username: 'miamiau', globalName: 'Mia', displayName: 'Mia ✿', avatar: '/static/demo/mia.svg',
      roles: [role('Anime-Club', '#f472b6', '🌸'), role('Event-Team', '#a78bfa')],
      joinedAt: ago(75), createdAt: ago(800), boostingSince: null, guildTag: TAG,
    },
    presence: { status: 'online', custom: { text: 'Matcha-Pause 🍵', emoji: null }, activity: null },
    profile: {
      tagline: 'Anime · Matcha · Hello Kitty',
      bio: 'Ich organisiere die Anime-Abende hier 🌸 Schreib mir deine Empfehlungen!',
      pronouns: 'sie/ihr', location: 'Köln', birthday: '__TODAY__',
      tags: ['Anime', 'Matcha', 'Cosplay', 'K-Pop'],
      fields: [{ label: 'Lieblingsanime', value: 'Frieren' }],
      links: [
        { url: 'https://myanimelist.net/', label: 'Meine Watchlist' },
        { url: 'https://www.pinterest.com/', label: '' },
        { url: 'https://www.tiktok.com/', label: '' },
      ],
      theme: { preset: 'candy', effect: 'hearts', nameEffect: 'gradient', font: 'hand', avatarShape: 'squircle' },
    },
  },
  {
    id: '100000000000000005',
    discord: {
      username: 'jonas.wav', globalName: 'Jonas', displayName: 'jonas.wav', avatar: '/static/demo/jonas.svg',
      roles: [role('Musiker', '#f59e0b', '🎧'), role('Booster', '#f472b6')],
      joinedAt: ago(330), createdAt: ago(2600), boostingSince: ago(330), guildTag: null,
    },
    presence: { status: 'online', custom: null, activity: { type: 'playing', name: 'FL Studio', details: 'Neuer Beat', state: null, image: null, startedAt: Date.now() - 95 * 60000 } },
    profile: {
      tagline: 'Producer · 140 BPM · Beats auf Anfrage',
      bio: 'Ich mache Beats (meistens Trap & Lo-Fi). Wenn du rappst oder singst – meld dich, lass was zusammen machen.',
      location: 'Dortmund',
      tags: ['Producing', 'FL Studio', 'Trap', 'Lo-Fi'],
      links: [
        { url: 'https://soundcloud.com/', label: 'Alle Beats' },
        { url: 'https://open.spotify.com/', label: '' },
        { url: 'https://www.instagram.com/', label: '' },
      ],
      song: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      theme: { preset: 'sunset', effect: 'fireflies', nameEffect: 'rainbow', font: 'marker', bgImage: '__SYNTHWAVE__', bgType: 'image', bgDim: 25, cardStyle: 'glass' },
    },
  },
  {
    id: '100000000000000006',
    discord: {
      username: 'ole_draussen', globalName: 'Ole', displayName: 'Ole', avatar: '/static/demo/ole.svg',
      roles: [role('Bücherwurm', '#84cc16', '📚')],
      joinedAt: ago(40), createdAt: ago(3900), boostingSince: null, guildTag: null,
    },
    presence: { status: 'offline', custom: null, activity: null },
    profile: {
      tagline: 'Wandern, Kaffee & Bücher',
      bio: 'Eher stiller Mitleser. Am Wochenende meistens im Wald unterwegs.',
      tags: ['Wandern', 'Bücher', 'Kaffee', 'Fotografie'],
      links: [{ url: 'https://www.strava.com/', label: '' }, { url: 'https://letterboxd.com/', label: '' }],
      theme: { preset: 'forest', effect: 'sakura', nameEffect: 'none', font: 'elegant', cardStyle: 'solid' },
    },
  },
];

async function makeSynthwave() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#12002b"/><stop offset=".55" stop-color="#5b0f6b"/><stop offset="1" stop-color="#ff6a3d"/></linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe259"/><stop offset="1" stop-color="#ff3d77"/></linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22003a"/><stop offset="1" stop-color="#05000d"/></linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#sky)"/>
  <g fill="#fff" opacity=".7">${Array.from({ length: 70 }, (_, i) => `<circle cx="${(i * 397) % 1920}" cy="${(i * 211) % 520}" r="${1 + (i % 3)}"/>`).join('')}</g>
  <circle cx="960" cy="640" r="260" fill="url(#sun)"/>
  <g fill="#5b0f6b">${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="600" y="${610 + i * 34}" width="720" height="${6 + i * 3}"/>`).join('')}</g>
  <path d="M0 760 L260 560 L430 700 L640 520 L840 760Z" fill="#2a0845"/>
  <path d="M1080 760 L1300 540 L1480 680 L1680 500 L1920 760Z" fill="#2a0845"/>
  <rect y="760" width="1920" height="320" fill="url(#ground)"/>
  <g stroke="#ff2ec4" stroke-width="3" opacity=".8">
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<line x1="0" y1="${770 + i * i * 6 + i * 20}" x2="1920" y2="${770 + i * i * 6 + i * 20}"/>`).join('')}
    ${Array.from({ length: 25 }, (_, i) => `<line x1="960" y1="760" x2="${-1500 + i * 205}" y2="1080"/>`).join('')}
  </g>
</svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer();
}

async function seed(store, log) {
  const synthName = `${crypto.randomBytes(12).toString('hex')}.webp`;
  fs.writeFileSync(path.join(store.uploadDir, synthName), await makeSynthwave());

  for (const [i, u] of USERS.entries()) {
    const slug = u.discord.username.replace(/_/g, '-').replace(/\.exe$/, '');
    const base = defaultProfile({ userId: u.id, slug, presetKey: u.profile.theme.preset });
    const { preset, ...themeOverrides } = u.profile.theme;
    const theme = { ...defaultTheme(preset), ...themeOverrides };
    if (theme.bgImage === '__SYNTHWAVE__') {
      theme.bgImage = `/uploads/${synthName}`;
      store.addUpload(synthName, { owner: u.id, kind: 'background', bytes: 0, createdAt: Date.now() });
    }
    const profile = sanitizeProfile({
      ...u.profile,
      birthday: u.profile.birthday === '__TODAY__' ? todayKey() : u.profile.birthday ?? '',
      theme,
    }, base);
    profile.views = 40 + i * 37;
    profile.updatedAt = Date.now() - i * 3600_000;
    store.putProfile(profile);
    store.putDiscord(u.id, { id: u.id, ...u.discord, inGuild: true, syncedAt: Date.now() });
  }
  store.flush();
  log.info(`🌱 ${USERS.length} Demo-Profile angelegt`);
}

export async function createDemo({ store, log }) {
  if (store.listProfiles().length === 0) await seed(store, log);
  store.setMeta('guild', GUILD);

  const adapter = {
    ready: true,
    guild: () => GUILD,
    async fetchMember(userId) {
      const u = USERS.find((x) => x.id === userId);
      const prev = store.getDiscord(userId);
      if (!u) return prev ? { ...prev, syncedAt: Date.now() } : { id: userId, inGuild: false, syncedAt: Date.now() };
      return { id: u.id, ...u.discord, inGuild: true, syncedAt: Date.now() };
    },
    presence: (userId) => USERS.find((x) => x.id === userId)?.presence ?? null,
  };

  const extraRoutes = (app, { store: s, site, sameOrigin }) => {
    app.get('/demo', (req, res) => {
      const list = s.listProfiles().map((p) => {
        const d = s.getDiscord(p.userId);
        return `<li><form method="post" action="/demo/login"><input type="hidden" name="user" value="${esc(p.userId)}"><button class="btn btn-ghost" type="submit">${esc(d?.displayName ?? p.slug)} bearbeiten</button></form></li>`;
      });
      res.send(pages.messagePage({
        site: site(),
        title: 'Demo-Login',
        emoji: '🧪',
        html: `Im echten Betrieb kommt der Login-Link vom Discord-Bot. Hier kannst du dich als Demo-Person einloggen:</p><ul class="demo-list">${list.join('')}</ul><p class="muted small">Demo-Daten liegen in <code>data-demo/</code>.`,
      }));
    });
    app.post('/demo/login', sameOrigin, express.urlencoded({ extended: false, limit: '1kb' }), (req, res) => {
      const userId = String(req.body?.user ?? '');
      if (!s.getProfile(userId)) return res.redirect(303, '/demo');
      const token = s.createLoginToken(userId, 15 * 60 * 1000);
      res.redirect(303, `/login?token=${encodeURIComponent(token)}`);
    });
  };

  return { adapter, extraRoutes };
}
