// Rendert die Profil-Karte als HTML-String.
// ISOMORPH: Der Server rendert damit die öffentliche Seite, der Editor die Live-Vorschau.
// Alle Nutzerdaten laufen durch esc() – niemals rohes HTML aus Profilen ausgeben!

import { BRAND_ICONS } from './brand-icons.js';
import { uiIcon } from './ui-icons.js';
import {
  FONTS, UPLOAD_PATH_RE, detectPlatform, defaultLinkLabel, parseSong, birthdayLabel, todayKey,
  formatMonthYear, hexToRgbTriplet, readableTextOn, displayNameOf,
} from './profile.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Bild-Hosts, die eingebunden werden dürfen (muss zur Content-Security-Policy passen). */
export const IMAGE_HOSTS = Object.freeze(['cdn.discordapp.com', 'media.discordapp.net', 'i.scdn.co']);

/** Lässt nur eigene Uploads/Assets und erlaubte CDNs durch – alles andere wird verworfen. */
export function safeImageUrl(url) {
  if (typeof url !== 'string' || !url) return '';
  if (UPLOAD_PATH_RE.test(url)) return url;
  if (/^\/static\/[a-z0-9/_-]+\.(?:png|webp|svg|jpg|gif)$/i.test(url) && !url.includes('..')) return url;
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' && IMAGE_HOSTS.includes(u.hostname)) return u.href;
  } catch {
    /* ungültig */
  }
  return '';
}

const cssUrl = (url) => `url("${url}")`;

export function brandIcon(platform, cls = 'ic') {
  const icon = BRAND_ICONS[platform];
  if (!icon) return uiIcon('globe', cls);
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${icon.p}"/></svg>`;
}

export function brandColor(platform) {
  return BRAND_ICONS[platform]?.c ?? null;
}

const STATUS_LABELS = { online: 'Online', idle: 'Abwesend', dnd: 'Bitte nicht stören', offline: 'Offline' };
const ACTIVITY = {
  playing: { verb: 'Spielt', icon: 'gamepad' },
  streaming: { verb: 'Streamt', icon: 'video' },
  listening: { verb: 'Hört', icon: 'headphones' },
  watching: { verb: 'Schaut', icon: 'tv' },
  competing: { verb: 'Tritt an in', icon: 'trophy' },
};

function since(ts, now) {
  if (!ts) return '';
  const min = Math.floor((now - ts) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `seit ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `seit ${h} Std.`;
  const d = Math.floor(h / 24);
  return `seit ${d} ${d === 1 ? 'Tag' : 'Tagen'}`;
}

function initials(name) {
  const ch = Array.from(String(name).trim())[0] ?? '?';
  return ch.toUpperCase();
}

const fmtInt = (n) => new Intl.NumberFormat('de-DE').format(Math.max(0, Math.floor(Number(n) || 0)));

export function renderActivity(presence, now = Date.now()) {
  const a = presence?.activity;
  if (!a || !ACTIVITY[a.type]) return '';
  const meta = ACTIVITY[a.type];
  const isSpotify = a.type === 'listening' && a.name === 'Spotify';
  const title = isSpotify ? a.details || 'Spotify' : a.name;
  const lines = isSpotify ? [a.state ? `von ${a.state}` : '', 'auf Spotify'] : [a.details, a.state];
  const img = safeImageUrl(a.image);
  const time = since(a.startedAt, now);
  return `<div class="pf-activity" data-activity>
    <div class="pf-activity-art">${img ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : uiIcon(meta.icon)}</div>
    <div class="pf-activity-text">
      <span class="pf-activity-verb">${esc(meta.verb)}${time ? ` · ${esc(time)}` : ''}</span>
      <strong>${esc(title)}</strong>
      ${lines.filter(Boolean).map((l) => `<span>${esc(l)}</span>`).join('')}
    </div>
  </div>`;
}

function renderCustomStatus(presence) {
  const c = presence?.custom;
  if (!c || (!c.text && !c.emoji)) return '';
  const emojiImg = c.emoji?.url ? safeImageUrl(c.emoji.url) : '';
  const emoji = emojiImg
    ? `<img class="pf-emoji" src="${esc(emojiImg)}" alt="${esc(c.emoji.name ?? '')}">`
    : c.emoji?.name
      ? `<span class="pf-emoji">${esc(c.emoji.name)}</span>`
      : '';
  return `<div class="pf-bubble" data-custom-status>${emoji}${c.text ? `<span>${esc(c.text)}</span>` : ''}</div>`;
}

function renderLinks(links, style, external) {
  if (!links.length) return '';
  const items = links.map((l) => {
    const platform = detectPlatform(l.url);
    const label = l.label || defaultLinkLabel(l.url);
    const brand = brandColor(platform) ?? 'var(--accent)';
    const fg = brandColor(platform) ? readableTextOn(brandColor(platform)) : 'var(--on-accent)';
    const attrs = `href="${esc(l.url)}" ${external} style="--brand:${esc(brand)};--on-brand:${esc(fg)}"`;
    if (style === 'icons') {
      return `<a class="pf-icon-link" ${attrs} title="${esc(label)}" aria-label="${esc(label)}">${brandIcon(platform)}</a>`;
    }
    return `<a class="pf-link" ${attrs}><span class="pf-link-icon">${brandIcon(platform)}</span><span class="pf-link-label">${esc(label)}</span>${uiIcon('external', 'ic pf-link-arrow')}</a>`;
  });
  return `<nav class="pf-links pf-links--${style === 'icons' ? 'icons' : 'buttons'}" aria-label="Links">${items.join('')}</nav>`;
}

function renderSong(url) {
  const song = url ? parseSong(url) : null;
  if (!song) return '';
  return `<section class="pf-section pf-song-wrap">
    <h2>${uiIcon('music')} Lieblingssong</h2>
    <div class="pf-song" data-embed="${esc(song.embed)}" data-height="${song.height}" data-provider="${esc(song.provider)}">
      <button type="button" class="pf-song-btn">${uiIcon('play')}<span>Abspielen<small>Lädt Inhalte von ${esc(song.label)} – erst nach deinem Klick.</small></span></button>
    </div>
  </section>`;
}

function renderRoles(roles) {
  if (!roles?.length) return '';
  const max = 14;
  const chips = roles.slice(0, max).map((r) => {
    const icon = safeImageUrl(r.icon);
    const color = /^#[0-9a-f]{6}$/i.test(r.color ?? '') ? r.color : '';
    const color2 = color && /^#[0-9a-f]{6}$/i.test(r.color2 ?? '') ? r.color2 : '';
    const lead = icon
      ? `<img src="${esc(icon)}" alt="" loading="lazy">`
      : r.emoji
        ? `<span class="pf-role-emoji">${esc(r.emoji)}</span>`
        : `<span class="pf-role-dot"></span>`;
    const style = color ? ` style="--rc:${color}${color2 ? `;--rc2:${color2}` : ''}"` : '';
    return `<li class="pf-role${color2 ? ' pf-role--gradient' : ''}"${style}>${lead}${esc(r.name)}</li>`;
  });
  if (roles.length > max) chips.push(`<li class="pf-role pf-role--more">+${roles.length - max}</li>`);
  return `<section class="pf-section"><h2>${uiIcon('shield')} Rollen</h2><ul class="pf-roles">${chips.join('')}</ul></section>`;
}

/**
 * @param {object} o
 * @param {object} o.profile   bereinigtes Profil
 * @param {object} [o.discord] Discord-Schnappschuss (Avatar, Rollen, …)
 * @param {object} [o.presence] Live-Status ({status, custom, activity}) oder null
 * @param {object} [o.site]    { name, iconUrl }
 * @param {boolean} [o.preview] Editor-Vorschau
 */
export function renderProfile({ profile, discord = {}, presence = null, site = {}, now = Date.now(), preview = false }) {
  const p = profile;
  const t = p.theme;
  const d = discord ?? {};
  const show = p.show;
  const font = FONTS[t.font] ?? FONTS.default;
  const name = displayNameOf(p, d);
  const external = 'target="_blank" rel="noopener noreferrer nofollow ugc"';

  const vars = [
    `--accent:${t.accent}`,
    `--accent-rgb:${hexToRgbTriplet(t.accent)}`,
    `--on-accent:${readableTextOn(t.accent)}`,
    `--bg1:${t.bg1}`,
    `--bg2:${t.bg2}`,
    `--bg1-rgb:${hexToRgbTriplet(t.bg1)}`,
    `--bg2-rgb:${hexToRgbTriplet(t.bg2)}`,
    `--bg-angle:${t.bgAngle}deg`,
    `--bg-blur:${t.bgBlur}px`,
    `--bg-dim:${(t.bgDim / 100).toFixed(2)}`,
    `--font-display:${font.css}`,
    `--display-weight:${font.weight}`,
    `--display-scale:${font.scale}`,
  ].join(';');

  const classes = [
    'pf',
    `pf--tone-${t.tone}`,
    `pf--card-${t.cardStyle}`,
    `pf--name-${t.nameEffect}`,
    `pf--avatar-${t.avatarShape}`,
    `pf--font-${t.font}`,
    t.bgAnimate && t.bgType === 'gradient' ? 'pf--bg-animate' : '',
    preview ? 'pf--preview' : '',
  ].filter(Boolean).join(' ');

  // ---- Hintergrund
  let bg;
  if (t.bgType === 'image' && safeImageUrl(t.bgImage)) {
    bg = `<div class="pf-bg pf-bg--image" style="background-image:${esc(cssUrl(safeImageUrl(t.bgImage)))}"></div>`;
  } else if (t.bgType === 'solid') {
    bg = '<div class="pf-bg pf-bg--solid"></div>';
  } else {
    bg = '<div class="pf-bg pf-bg--gradient"><i></i><i></i></div>';
  }

  // ---- Banner
  let bannerUrl = '';
  if (t.banner === 'image') bannerUrl = safeImageUrl(t.bannerImage);
  if (t.banner === 'discord' || (t.banner === 'image' && !bannerUrl)) bannerUrl = safeImageUrl(d.banner);
  const banner = t.banner === 'none'
    ? ''
    : `<div class="pf-banner${bannerUrl ? '' : ' pf-banner--accent'}"${bannerUrl ? ` style="background-image:${esc(cssUrl(bannerUrl))}"` : ''}></div>`;

  // ---- Avatar & Status
  const avatarUrl = safeImageUrl(d.avatar);
  const deco = safeImageUrl(d.decoration);
  const status = show.status && presence?.status ? presence.status : null;
  const avatar = `<div class="pf-avatar">
      ${avatarUrl ? `<img class="pf-avatar-img" src="${esc(avatarUrl)}" alt="Avatar von ${esc(name)}" width="128" height="128">` : `<span class="pf-avatar-img pf-avatar-fallback">${esc(initials(name))}</span>`}
      ${deco ? `<img class="pf-deco" src="${esc(deco)}" alt="" aria-hidden="true">` : ''}
      ${status ? `<span class="pf-status pf-status--${esc(status)}" data-status title="${esc(STATUS_LABELS[status] ?? status)}"></span>` : ''}
    </div>`;

  // ---- Kopfzeile unter dem Namen
  const handleBits = [];
  if (show.username && d.username) handleBits.push(`<span>@${esc(d.username)}</span>`);
  if (p.pronouns) handleBits.push(`<span>${esc(p.pronouns)}</span>`);
  const tagBadge = safeImageUrl(d.guildTag?.badge);
  if (d.guildTag?.tag) {
    handleBits.push(`<span class="pf-guildtag" title="Server-Tag">${tagBadge ? `<img src="${esc(tagBadge)}" alt="">` : ''}${esc(d.guildTag.tag)}</span>`);
  }

  const isBirthday = p.birthday && p.birthday === todayKey(now);

  // ---- Fakten-Kacheln
  const facts = [];
  if (p.location) facts.push({ icon: 'pin', label: 'Ort', value: p.location });
  if (p.birthday) facts.push({ icon: 'cake', label: 'Geburtstag', value: birthdayLabel(p.birthday) });
  for (const f of p.fields) facts.push({ icon: 'sparkle', label: f.label, value: f.value });
  const factsHtml = facts.length
    ? `<ul class="pf-facts">${facts.map((f) => `<li>${uiIcon(f.icon)}<span><small>${esc(f.label)}</small>${esc(f.value)}</span></li>`).join('')}</ul>`
    : '';

  const tagsHtml = p.tags.length
    ? `<section class="pf-section"><h2>${uiIcon('tag')} Interessen</h2><ul class="pf-tags">${p.tags.map((tag) => `<li>${esc(tag)}</li>`).join('')}</ul></section>`
    : '';

  const bioHtml = p.bio
    ? `<section class="pf-section"><h2>${uiIcon('message')} Über mich</h2><p class="pf-bio">${esc(p.bio)}</p></section>`
    : '';

  // ---- Fußzeile
  const meta = [];
  if (show.joined && d.joinedAt) meta.push(`<span>${uiIcon('calendar')} Auf dem Server seit ${esc(formatMonthYear(d.joinedAt))}</span>`);
  if (show.created && d.createdAt) meta.push(`<span>${uiIcon('user')} Bei Discord seit ${esc(formatMonthYear(d.createdAt))}</span>`);
  if (d.boostingSince) meta.push(`<span class="pf-boost">${uiIcon('gem')} Boostet seit ${esc(formatMonthYear(d.boostingSince))}</span>`);
  if (show.views) meta.push(`<span>${uiIcon('eye')} ${fmtInt(p.views)} ${p.views === 1 ? 'Aufruf' : 'Aufrufe'}</span>`);

  const siteIcon = safeImageUrl(site.iconUrl);
  const siteLink = site.name
    ? `<a class="pf-site" href="/"${preview ? ' target="_blank"' : ''}>${siteIcon ? `<img src="${esc(siteIcon)}" alt="">` : uiIcon('users')}<span>${esc(site.name)}</span></a>`
    : '';

  const iconLinks = t.linkStyle === 'icons' ? renderLinks(p.links, 'icons', external) : '';
  const buttonLinks = t.linkStyle !== 'icons' ? renderLinks(p.links, 'buttons', external) : '';

  return `<div class="${classes}" style="${esc(vars)}" data-effect="${esc(t.effect)}" data-accent="${esc(t.accent)}" data-tilt="${t.tilt ? 1 : 0}" data-typewriter="${t.typewriter ? 1 : 0}" data-user="${esc(p.userId)}" data-live="${show.status || show.activity ? 1 : 0}">
  ${bg}
  <div class="pf-dim"></div>
  <canvas class="pf-fx" aria-hidden="true"></canvas>
  <main class="pf-wrap">
    <article class="pf-card">
      ${banner}
      <div class="pf-top${banner ? '' : ' pf-top--nobanner'}">
        ${avatar}
        ${show.status ? renderCustomStatus(presence) : ''}
      </div>
      <div class="pf-body">
        <h1 class="pf-name" data-text="${esc(name)}">${esc(name)}</h1>
        ${handleBits.length ? `<p class="pf-handle">${handleBits.join('<span class="pf-sep">·</span>')}</p>` : ''}
        ${isBirthday ? '<p class="pf-birthday">🎂 Hat heute Geburtstag!</p>' : ''}
        ${p.tagline ? `<p class="pf-tagline"><span data-type>${esc(p.tagline)}</span></p>` : ''}
        ${iconLinks}
        <div class="pf-live">${show.activity ? renderActivity(presence, now) : ''}</div>
        ${bioHtml}
        ${factsHtml}
        ${tagsHtml}
        ${buttonLinks}
        ${renderSong(p.song)}
        ${show.roles ? renderRoles(d.roles) : ''}
        ${meta.length ? `<footer class="pf-meta">${meta.join('')}</footer>` : ''}
      </div>
    </article>
    ${siteLink}
  </main>
</div>`;
}
