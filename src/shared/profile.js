// Profil-Datenmodell: Standardwerte, Auswahl-Optionen, Bereinigung & Validierung.
// ISOMORPH: Wird vom Server UND im Browser (Editor-Vorschau) benutzt – keine Node-Imports hier!

import { BRAND_ICONS } from './brand-icons.js';

export const LIMITS = Object.freeze({
  displayName: 32,
  tagline: 90,
  bio: 700,
  pronouns: 24,
  location: 40,
  tagCount: 12,
  tag: 24,
  fieldCount: 8,
  fieldLabel: 24,
  fieldValue: 60,
  linkCount: 12,
  linkLabel: 32,
  url: 300,
  slugMin: 2,
  slugMax: 32,
});

/** Schriften für Name & Überschriften. `scale` gleicht sehr breite/schmale Schriften aus. */
export const FONTS = Object.freeze({
  default: { label: 'Standard', css: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", weight: 800, scale: 1 },
  grotesk: { label: 'Grotesk', css: "'Space Grotesk', system-ui, sans-serif", weight: 700, scale: 1 },
  futur: { label: 'Futuristisch', css: "'Orbitron', system-ui, sans-serif", weight: 800, scale: 0.86 },
  pixel: { label: 'Pixel', css: "'Press Start 2P', ui-monospace, monospace", weight: 400, scale: 0.6 },
  elegant: { label: 'Elegant', css: "'Playfair Display', Georgia, serif", weight: 800, scale: 1.05 },
  code: { label: 'Code', css: "'JetBrains Mono', ui-monospace, monospace", weight: 800, scale: 0.92 },
  hand: { label: 'Handschrift', css: "'Caveat', 'Comic Sans MS', cursive", weight: 700, scale: 1.35 },
  marker: { label: 'Marker', css: "'Permanent Marker', 'Comic Sans MS', cursive", weight: 400, scale: 1 },
});

export const EFFECTS = Object.freeze({
  none: { label: 'Keiner', emoji: '🚫' },
  stars: { label: 'Sterne', emoji: '🌌' },
  snow: { label: 'Schnee', emoji: '❄️' },
  rain: { label: 'Regen', emoji: '🌧️' },
  fireflies: { label: 'Glühwürmchen', emoji: '✨' },
  particles: { label: 'Netzwerk', emoji: '🕸️' },
  matrix: { label: 'Matrix', emoji: '💻' },
  hearts: { label: 'Herzen', emoji: '💖' },
  sakura: { label: 'Kirschblüten', emoji: '🌸' },
});

export const NAME_EFFECTS = Object.freeze({
  none: 'Keiner',
  glow: 'Leuchten',
  gradient: 'Verlauf',
  rainbow: 'Regenbogen',
  glitch: 'Glitch',
  shine: 'Glanz',
});

export const CARD_STYLES = Object.freeze({ glass: 'Glas', solid: 'Solide', neon: 'Neon', minimal: 'Ohne Karte' });
export const BG_TYPES = Object.freeze({ gradient: 'Verlauf', solid: 'Farbe', image: 'Bild' });
export const BANNERS = Object.freeze({ discord: 'Discord', image: 'Eigenes Bild', accent: 'Akzentfarbe', none: 'Keins' });
export const AVATAR_SHAPES = Object.freeze({ circle: 'Rund', squircle: 'Abgerundet' });
export const LINK_STYLES = Object.freeze({ buttons: 'Buttons', icons: 'Nur Icons' });
export const TONES = Object.freeze({ dark: 'Dunkel', light: 'Hell' });

/** Farb-Vorlagen – setzen im Editor nur die Farbwerte, gespeichert werden die Farben selbst. */
export const PRESETS = Object.freeze({
  midnight: { label: 'Mitternacht', accent: '#a78bfa', bg1: '#0f0c29', bg2: '#302b63', tone: 'dark' },
  neon: { label: 'Neon', accent: '#22d3ee', bg1: '#020617', bg2: '#2e1065', tone: 'dark' },
  sunset: { label: 'Sunset', accent: '#fdba74', bg1: '#2e1065', bg2: '#c2410c', tone: 'dark' },
  ocean: { label: 'Ozean', accent: '#38bdf8', bg1: '#071423', bg2: '#155e75', tone: 'dark' },
  forest: { label: 'Wald', accent: '#86efac', bg1: '#06140c', bg2: '#1f4d36', tone: 'dark' },
  blood: { label: 'Blut', accent: '#f87171', bg1: '#0a0000', bg2: '#5b0b0b', tone: 'dark' },
  gold: { label: 'Gold', accent: '#fbbf24', bg1: '#0c0a09', bg2: '#4a3410', tone: 'dark' },
  aurora: { label: 'Aurora', accent: '#5eead4', bg1: '#042f2e', bg2: '#3b0764', tone: 'dark' },
  mono: { label: 'Mono', accent: '#f4f4f5', bg1: '#000000', bg2: '#2a2a2e', tone: 'dark' },
  candy: { label: 'Candy', accent: '#db2777', bg1: '#fbcfe8', bg2: '#c7d2fe', tone: 'light' },
  ice: { label: 'Eis', accent: '#0284c7', bg1: '#f8fafc', bg2: '#bae6fd', tone: 'light' },
});

/** Pfade, die nicht als Profil-URL vergeben werden dürfen. */
export const RESERVED_SLUGS = new Set([
  'api', 'static', 'uploads', 'shared', 'fonts', 'edit', 'login', 'logout', 'demo', 'u', 'healthz',
  'robots.txt', 'favicon.ico', 'favicon.svg', 'sitemap.xml', 'admin', 'impressum', 'datenschutz', 'privacy',
  'mitglieder', 'members', 'profil', 'profile', 'profiles', 'settings', 'einstellungen', 'about', 'help',
  'hilfe', 'www', 'discord', 'bot', 'index', 'null', 'undefined', 'me', 'new', 'neu', 'assets', 'preview',
  'vorschau', 'mod', 'moderator', 'support', 'team', 'server', 'home', 'start',
]);

export const UPLOAD_PATH_RE = /^\/uploads\/[a-z0-9]{16,64}\.webp$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;

// ------------------------------------------------------------------ Helfer

/** Entfernt Steuerzeichen & Bidi-Tricks, normalisiert Zeilenumbrüche, kürzt auf `max` Zeichen. */
export function cleanText(value, max, { multiline = false } = {}) {
  if (value === null || value === undefined) return '';
  let s = String(value).replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
  // Bidi-Override-Zeichen (Spoofing) und unsichtbare Steuerzeichen raus
  s = s.replace(/[‪-‮⁦-⁩‎‏]/g, '');
  s = s.replace(multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, multiline ? '' : ' ');
  if (multiline) {
    s = s.split('\n').map((l) => l.replace(/[ \t]+$/g, '')).join('\n').replace(/\n{3,}/g, '\n\n');
  } else {
    s = s.replace(/\s+/g, ' ');
  }
  s = s.trim();
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, max).join('').trim() : s;
}

const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);
const pick = (v, allowed, fallback) => (typeof v === 'string' && Object.hasOwn(allowed, v) ? v : fallback);
const color = (v, fallback) => (typeof v === 'string' && HEX_RE.test(v) ? v.toLowerCase() : fallback);
function int(v, min, max, fallback) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
const uploadPath = (v, fallback) => (v === '' ? '' : typeof v === 'string' && UPLOAD_PATH_RE.test(v) ? v : fallback);

/** Macht aus Nutzereingaben eine saubere http(s)-URL oder gibt null zurück. */
export function normalizeUrl(input) {
  let s = cleanText(input, LIMITS.url * 4); // nicht still abschneiden – zu lange Links werden unten verworfen
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^[^:/]+\.[^:/]+:\d+/.test(s)) return null; // javascript:, mailto: …
    s = `https://${s}`;
  }
  let u;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (u.username || u.password) return null;
  if (!u.hostname.includes('.') || u.hostname.endsWith('.')) return null;
  const href = u.href;
  return href.length > LIMITS.url ? null : href;
}

const PLATFORM_HOSTS = {
  instagram: ['instagram.com', 'instagr.am'],
  tiktok: ['tiktok.com'],
  youtube: ['youtube.com', 'youtu.be'],
  twitch: ['twitch.tv'],
  kick: ['kick.com'],
  spotify: ['spotify.com', 'spotify.link'],
  applemusic: ['music.apple.com'],
  soundcloud: ['soundcloud.com'],
  deezer: ['deezer.com', 'deezer.page.link'],
  x: ['x.com', 'twitter.com'],
  threads: ['threads.net', 'threads.com'],
  bluesky: ['bsky.app'],
  mastodon: ['mastodon.social', 'mastodon.online', 'chaos.social'],
  reddit: ['reddit.com', 'redd.it'],
  snapchat: ['snapchat.com'],
  discord: ['discord.gg', 'discord.com', 'discordapp.com'],
  telegram: ['t.me', 'telegram.me'],
  whatsapp: ['wa.me', 'whatsapp.com'],
  facebook: ['facebook.com', 'fb.com', 'fb.me'],
  pinterest: ['pinterest.com', 'pinterest.de', 'pin.it'],
  tumblr: ['tumblr.com'],
  github: ['github.com'],
  gitlab: ['gitlab.com'],
  steam: ['steamcommunity.com', 'steampowered.com', 's.team'],
  epicgames: ['epicgames.com'],
  playstation: ['playstation.com', 'psnprofiles.com'],
  roblox: ['roblox.com'],
  battledotnet: ['battle.net'],
  riotgames: ['riotgames.com'],
  faceit: ['faceit.com'],
  osu: ['osu.ppy.sh'],
  lastdotfm: ['last.fm'],
  letterboxd: ['letterboxd.com'],
  myanimelist: ['myanimelist.net'],
  anilist: ['anilist.co'],
  chessdotcom: ['chess.com'],
  lichess: ['lichess.org'],
  paypal: ['paypal.me', 'paypal.com'],
  kofi: ['ko-fi.com'],
  patreon: ['patreon.com'],
  buymeacoffee: ['buymeacoffee.com'],
  linktree: ['linktr.ee'],
  vrchat: ['vrchat.com'],
  itchdotio: ['itch.io'],
  artstation: ['artstation.com'],
  deviantart: ['deviantart.com'],
  behance: ['behance.net'],
  bandcamp: ['bandcamp.com'],
  namemc: ['namemc.com'],
  medium: ['medium.com'],
  substack: ['substack.com'],
  vimeo: ['vimeo.com'],
  imdb: ['imdb.com'],
  duolingo: ['duolingo.com'],
  strava: ['strava.com'],
  bereal: ['bere.al', 'bereal.com'],
  wattpad: ['wattpad.com'],
  archiveofourown: ['archiveofourown.org'],
};
const HOST_TO_PLATFORM = new Map();
for (const [platform, hosts] of Object.entries(PLATFORM_HOSTS)) {
  for (const h of hosts) HOST_TO_PLATFORM.set(h, platform);
}

/** Erkennt die Plattform eines Links (für Icon & Standard-Beschriftung). */
export function detectPlatform(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'website';
  }
  const parts = host.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.');
    const hit = HOST_TO_PLATFORM.get(candidate);
    if (hit && BRAND_ICONS[hit]) return hit;
  }
  return 'website';
}

/** Standard-Beschriftung, falls der Nutzer keine eigene angibt. */
export function defaultLinkLabel(url) {
  const platform = detectPlatform(url);
  if (platform !== 'website') return BRAND_ICONS[platform].t;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Link';
  }
}

/** Erkennt Spotify-/YouTube-/SoundCloud-Links und baut die Einbettungs-URL. */
export function parseSong(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');

  if (host === 'open.spotify.com') {
    const m = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]{10,40})\/?$/);
    if (!m) return null;
    const compact = m[1] === 'track' || m[1] === 'episode';
    return { provider: 'spotify', label: 'Spotify', embed: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, height: compact ? 152 : 352 };
  }

  let ytId = null;
  if (host === 'youtu.be') ytId = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') ytId = u.searchParams.get('v');
    else ytId = u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/)?.[1] ?? null;
  }
  if (ytId !== null) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(ytId)) return null;
    return { provider: 'youtube', label: 'YouTube', embed: `https://www.youtube-nocookie.com/embed/${ytId}`, height: 0 };
  }

  if (host === 'soundcloud.com' && /^\/[\w-]+\/[\w-]+\/?$/.test(u.pathname)) {
    const track = `https://soundcloud.com${u.pathname}`;
    return {
      provider: 'soundcloud',
      label: 'SoundCloud',
      embed: `https://w.soundcloud.com/player/?url=${encodeURIComponent(track)}&auto_play=false&visual=false&show_comments=false`,
      height: 166,
    };
  }
  return null;
}

/** Vorschlag für eine Profil-URL aus dem Discord-Namen. */
export function slugify(name) {
  let s = String(name ?? '').toLowerCase();
  s = s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '').replace(/([._-])[._-]+/g, '$1');
  s = s.replace(/^[._-]+|[._-]+$/g, '').slice(0, LIMITS.slugMax).replace(/[._-]+$/g, '');
  return s.length >= LIMITS.slugMin ? s : '';
}

/** Gibt eine Fehlermeldung zurück oder null, wenn der Slug okay ist (Eindeutigkeit prüft der Server). */
export function validateSlug(slug) {
  if (typeof slug !== 'string' || slug.length < LIMITS.slugMin) return `Mindestens ${LIMITS.slugMin} Zeichen.`;
  if (slug.length > LIMITS.slugMax) return `Höchstens ${LIMITS.slugMax} Zeichen.`;
  if (!SLUG_RE.test(slug)) return 'Nur a–z, 0–9, Punkt, Minus und Unterstrich (nicht am Anfang/Ende).';
  if (RESERVED_SLUGS.has(slug)) return 'Diese Adresse ist reserviert.';
  return null;
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Geburtstag als "MM-DD" (ohne Jahr – das Alter geht niemanden was an). */
export function normalizeBirthday(v) {
  if (typeof v !== 'string') return '';
  const m = v.match(/^(\d{2})-(\d{2})$/);
  if (!m) return '';
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]) return '';
  return v;
}

export function birthdayLabel(bday) {
  const m = normalizeBirthday(bday).match(/^(\d{2})-(\d{2})$/);
  return m ? `${Number(m[2])}. ${MONTHS[Number(m[1]) - 1]}` : '';
}

/** "MM-DD" von heute in deutscher Zeit. */
export function todayKey(now = Date.now(), timeZone = 'Europe/Berlin') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, month: '2-digit', day: '2-digit' }).formatToParts(new Date(now));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('month')}-${get('day')}`;
}

export function formatMonthYear(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' }).format(d);
}

export function formatDate(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' }).format(d);
}

/** "#aabbcc" -> "170 187 204" (für rgb(var(--x) / alpha) in CSS). */
export function hexToRgbTriplet(hex) {
  const h = HEX_RE.test(hex ?? '') ? hex.slice(1) : '8b5cf6';
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
}

/** Gut lesbare Textfarbe (schwarz/weiß) auf einer Hintergrundfarbe. */
export function readableTextOn(hex) {
  const [r, g, b] = hexToRgbTriplet(hex).split(' ').map((n) => {
    const c = Number(n) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? '#0b0b0f' : '#ffffff';
}

/** Deterministische "zufällige" Vorlage pro Nutzer, damit neue Profile nicht alle gleich aussehen. */
export function presetForUser(userId) {
  const keys = Object.keys(PRESETS).filter((k) => PRESETS[k].tone === 'dark');
  let hash = 0;
  for (const ch of String(userId)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return keys[hash % keys.length];
}

// ------------------------------------------------------------------ Profil

export function defaultTheme(presetKey = 'midnight') {
  const preset = PRESETS[presetKey] ?? PRESETS.midnight;
  return {
    accent: preset.accent,
    tone: preset.tone,
    bgType: 'gradient',
    bg1: preset.bg1,
    bg2: preset.bg2,
    bgAngle: 135,
    bgAnimate: true,
    bgImage: '',
    bgBlur: 0,
    bgDim: 30,
    banner: 'discord',
    bannerImage: '',
    cardStyle: 'glass',
    font: 'default',
    nameEffect: 'glow',
    effect: 'stars',
    typewriter: false,
    tilt: true,
    avatarShape: 'circle',
    linkStyle: 'buttons',
  };
}

export function defaultShow() {
  return { username: true, roles: true, joined: true, created: false, status: true, activity: true, views: true };
}

export function defaultProfile({ userId, slug, presetKey, now = Date.now() }) {
  return {
    userId: String(userId),
    slug,
    published: true,
    listed: true,
    hidden: false,
    displayName: '',
    tagline: '',
    bio: '',
    pronouns: '',
    location: '',
    birthday: '',
    tags: [],
    fields: [],
    links: [],
    song: '',
    theme: defaultTheme(presetKey ?? presetForUser(userId)),
    show: defaultShow(),
    views: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Übernimmt nur die vom Nutzer änderbaren Felder aus `input` und bereinigt sie.
 * System-Felder (userId, views, hidden, Zeitstempel) kommen immer aus `base`.
 * Ungültige Werte fallen still auf den bisherigen Wert zurück.
 */
export function sanitizeProfile(input, base) {
  const src = input && typeof input === 'object' ? input : {};
  const t = src.theme && typeof src.theme === 'object' ? src.theme : {};
  const s = src.show && typeof src.show === 'object' ? src.show : {};
  const bt = base.theme;
  const bs = base.show;

  const seenTags = new Set();
  const tags = [];
  for (const raw of Array.isArray(src.tags) ? src.tags : base.tags) {
    const tag = cleanText(raw, LIMITS.tag).replace(/^#+/, '');
    const key = tag.toLowerCase();
    if (!tag || seenTags.has(key)) continue;
    seenTags.add(key);
    tags.push(tag);
    if (tags.length >= LIMITS.tagCount) break;
  }

  const fields = [];
  for (const f of Array.isArray(src.fields) ? src.fields : base.fields) {
    if (!f || typeof f !== 'object') continue;
    const label = cleanText(f.label, LIMITS.fieldLabel);
    const value = cleanText(f.value, LIMITS.fieldValue);
    if (!label || !value) continue;
    fields.push({ label, value });
    if (fields.length >= LIMITS.fieldCount) break;
  }

  const links = [];
  for (const l of Array.isArray(src.links) ? src.links : base.links) {
    if (!l || typeof l !== 'object') continue;
    const url = normalizeUrl(l.url);
    if (!url) continue;
    links.push({ url, label: cleanText(l.label, LIMITS.linkLabel) });
    if (links.length >= LIMITS.linkCount) break;
  }

  let song = base.song;
  if (typeof src.song === 'string') {
    const url = normalizeUrl(src.song);
    song = url && parseSong(url) ? url : '';
  }

  const theme = {
    accent: color(t.accent, bt.accent),
    tone: pick(t.tone, TONES, bt.tone),
    bgType: pick(t.bgType, BG_TYPES, bt.bgType),
    bg1: color(t.bg1, bt.bg1),
    bg2: color(t.bg2, bt.bg2),
    bgAngle: int(t.bgAngle, 0, 360, bt.bgAngle),
    bgAnimate: bool(t.bgAnimate, bt.bgAnimate),
    bgImage: uploadPath(t.bgImage, bt.bgImage),
    bgBlur: int(t.bgBlur, 0, 20, bt.bgBlur),
    bgDim: int(t.bgDim, 0, 85, bt.bgDim),
    banner: pick(t.banner, BANNERS, bt.banner),
    bannerImage: uploadPath(t.bannerImage, bt.bannerImage),
    cardStyle: pick(t.cardStyle, CARD_STYLES, bt.cardStyle),
    font: pick(t.font, FONTS, bt.font),
    nameEffect: pick(t.nameEffect, NAME_EFFECTS, bt.nameEffect),
    effect: pick(t.effect, EFFECTS, bt.effect),
    typewriter: bool(t.typewriter, bt.typewriter),
    tilt: bool(t.tilt, bt.tilt),
    avatarShape: pick(t.avatarShape, AVATAR_SHAPES, bt.avatarShape),
    linkStyle: pick(t.linkStyle, LINK_STYLES, bt.linkStyle),
  };
  if (theme.bgType === 'image' && !theme.bgImage) theme.bgType = 'gradient';
  if (theme.banner === 'image' && !theme.bannerImage) theme.banner = 'discord';

  const show = {};
  for (const key of Object.keys(defaultShow())) show[key] = bool(s[key], bs[key]);

  return {
    userId: base.userId,
    slug: typeof src.slug === 'string' ? src.slug.trim().toLowerCase() : base.slug,
    published: bool(src.published, base.published),
    listed: bool(src.listed, base.listed),
    hidden: base.hidden,
    displayName: typeof src.displayName === 'string' ? cleanText(src.displayName, LIMITS.displayName) : base.displayName,
    tagline: typeof src.tagline === 'string' ? cleanText(src.tagline, LIMITS.tagline) : base.tagline,
    bio: typeof src.bio === 'string' ? cleanText(src.bio, LIMITS.bio, { multiline: true }) : base.bio,
    pronouns: typeof src.pronouns === 'string' ? cleanText(src.pronouns, LIMITS.pronouns) : base.pronouns,
    location: typeof src.location === 'string' ? cleanText(src.location, LIMITS.location) : base.location,
    birthday: typeof src.birthday === 'string' ? normalizeBirthday(src.birthday) : base.birthday,
    tags,
    fields,
    links,
    song,
    theme,
    show,
    views: base.views,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
  };
}

/** Name, der auf dem Profil angezeigt wird. */
export function displayNameOf(profile, discord) {
  return profile?.displayName || discord?.displayName || discord?.globalName || discord?.username || 'Unbekannt';
}

/** Öffentliche, für den Editor nötige Optionen (wird als JSON an den Browser gegeben). */
export const OPTIONS = Object.freeze({
  LIMITS, FONTS, EFFECTS, NAME_EFFECTS, CARD_STYLES, BG_TYPES, BANNERS, AVATAR_SHAPES, LINK_STYLES, TONES, PRESETS,
});
