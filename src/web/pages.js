// HTML-Seiten (Server-seitig gerendert). Nutzerdaten IMMER mit esc() ausgeben.
import { esc, renderProfile, safeImageUrl } from '../shared/render.js';
import { uiIcon } from '../shared/ui-icons.js';
import { displayNameOf, hexToRgbTriplet, readableTextOn } from '../shared/profile.js';

export const ASSET_VERSION = Date.now().toString(36);
const v = (url) => `${url}?v=${ASSET_VERSION}`;

/** JSON sicher in ein <script type="application/json"> einbetten. */
export function jsonForScript(data) {
  const LS = String.fromCharCode(0x2028);
  const PS = String.fromCharCode(0x2029);
  return JSON.stringify(data).replace(/</g, '\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029');
}

export function layout({ title, description = '', head = '', body, bodyClass = '', styles = [], scripts = [] }) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
${description ? `<meta name="description" content="${esc(description)}">` : ''}
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml">
${styles.map((s) => `<link rel="stylesheet" href="${v(s)}">`).join('\n')}
${head}
</head>
<body class="${esc(bodyClass)}">
${body}
${scripts.map((s) => `<script type="module" src="${v(s)}"></script>`).join('\n')}
</body>
</html>`;
}

function topbar(site, { right = '' } = {}) {
  const icon = safeImageUrl(site.iconUrl);
  return `<header class="topbar">
  <a class="brand" href="/">${icon ? `<img src="${esc(icon)}" alt="">` : `<span class="brand-mark">${uiIcon('sparkle')}</span>`}<span>${esc(site.name)}</span></a>
  <nav class="topbar-nav">${right}</nav>
</header>`;
}

function footer(site) {
  return `<footer class="site-footer">
  <p>${esc(site.name)} · Profile · Bearbeiten über den Discord-Bot mit <code>/profil bearbeiten</code></p>
</footer>`;
}

// ---------------------------------------------------------------- Profil-Seite
export function profilePage({ profile, discord, presence, site, publicUrl, notice = '' }) {
  const name = displayNameOf(profile, discord);
  const canonical = `${publicUrl}/${profile.slug}`;
  const description = profile.tagline || (profile.bio ? truncate(profile.bio, 180) : `Das Profil von ${name} auf ${site.name}.`);
  const avatar = discord?.avatar && /^https:\/\//.test(discord.avatar) ? discord.avatar : '';
  const title = discord?.username ? `${name} (@${discord.username})` : name;
  const meta = [
    ['og:type', 'profile'],
    ['og:site_name', site.name],
    ['og:title', title],
    ['og:description', description],
    ['og:url', canonical],
    ['og:locale', 'de_DE'],
    avatar && ['og:image', avatar],
  ].filter(Boolean);
  const head = `${meta.map(([k, val]) => `<meta property="${k}" content="${esc(val)}">`).join('\n')}
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="${esc(profile.theme.accent)}">
<link rel="canonical" href="${esc(canonical)}">`;

  const noticeHtml = notice ? `<div class="pf-notice" role="status">${uiIcon('lock')}<span>${esc(notice)}</span> <a href="/edit">Zum Editor</a></div>` : '';
  return layout({
    title: `${title} · ${site.name}`,
    description,
    head,
    bodyClass: 'page-profile',
    styles: ['/static/css/fonts.css', '/static/css/profile.css'],
    scripts: ['/static/js/profile.js'],
    body: `${noticeHtml}${renderProfile({ profile, discord, presence, site })}`,
  });
}

function truncate(s, n) {
  const chars = Array.from(String(s).replace(/\s+/g, ' ').trim());
  return chars.length > n ? `${chars.slice(0, n - 1).join('')}…` : chars.join('');
}

// ---------------------------------------------------------------- Mitgliederliste
export function directoryPage({ site, entries, me }) {
  const cards = entries.map(({ profile: p, discord: d }) => {
    const name = displayNameOf(p, d);
    const avatar = safeImageUrl(d?.avatar);
    const banner = p.theme.banner === 'image' ? safeImageUrl(p.theme.bannerImage) : p.theme.banner === 'discord' ? safeImageUrl(d?.banner) : '';
    const search = [name, d?.username, p.tagline, p.location, ...p.tags].filter(Boolean).join(' ').toLowerCase();
    const style = `--accent:${p.theme.accent};--accent-rgb:${hexToRgbTriplet(p.theme.accent)};--bg1:${p.theme.bg1};--bg2:${p.theme.bg2};--on-accent:${readableTextOn(p.theme.accent)}`;
    return `<li class="mcard-li" data-search="${esc(search)}" data-name="${esc(name.toLowerCase())}" data-updated="${p.updatedAt}">
  <a class="mcard" href="/${esc(p.slug)}" style="${esc(style)}">
    <div class="mcard-banner"${banner ? ` style="background-image:url(&quot;${esc(banner)}&quot;)"` : ''}></div>
    <div class="mcard-avatar">${avatar ? `<img src="${esc(avatar)}" alt="" loading="lazy">` : `<span>${esc(Array.from(name)[0]?.toUpperCase() ?? '?')}</span>`}</div>
    <div class="mcard-body">
      <strong class="mcard-name">${esc(name)}</strong>
      ${d?.username ? `<span class="mcard-handle">@${esc(d.username)}</span>` : ''}
      ${p.tagline ? `<p class="mcard-tagline">${esc(p.tagline)}</p>` : ''}
      ${p.tags.length ? `<ul class="mcard-tags">${p.tags.slice(0, 3).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    </div>
  </a>
</li>`;
  });

  const icon = safeImageUrl(site.iconUrl);
  const right = me
    ? `<a class="btn btn-ghost" href="/${esc(me.slug)}">${uiIcon('user')}<span>Mein Profil</span></a><a class="btn btn-primary" href="/edit">${uiIcon('pencil')}<span>Bearbeiten</span></a>`
    : '';
  const stats = [`<span><b>${entries.length}</b> ${entries.length === 1 ? 'Profil' : 'Profile'}</span>`];
  if (site.memberCount) stats.push(`<span><b>${new Intl.NumberFormat('de-DE').format(site.memberCount)}</b> Mitglieder</span>`);

  const body = `${topbar(site, { right })}
<main class="dir">
  <section class="hero">
    <div class="hero-glow" aria-hidden="true"></div>
    <div class="hero-icon">${icon ? `<img src="${esc(icon)}" alt="">` : uiIcon('users')}</div>
    <h1>${esc(site.name)}</h1>
    <p class="hero-lead">Die Profile unserer Community. Jedes Mitglied baut sich hier seine eigene Seite und packt den Link in die Discord-Bio.</p>
    <div class="hero-stats">${stats.join('')}</div>
  </section>

  <section class="howto" aria-label="So geht's">
    <div class="step"><span class="step-n">1</span><div><h3>Im Discord <code>/profil bearbeiten</code></h3><p>Der Bot schickt dir einen privaten Login-Link, nur du siehst ihn.</p></div></div>
    <div class="step"><span class="step-n">2</span><div><h3>Profil gestalten</h3><p>Bio, Links, Lieblingssong, Hintergrund, Effekte – mit Live-Vorschau.</p></div></div>
    <div class="step"><span class="step-n">3</span><div><h3>Link in die Bio</h3><p>Kopier deinen Link ins Discord-„Über mich“. Fertig!</p></div></div>
  </section>

  <section class="members">
    <div class="members-head">
      <h2>Mitglieder</h2>
      <div class="members-tools">
        <label class="search">${uiIcon('search')}<input type="search" placeholder="Name, Interesse, Ort …" data-search-input aria-label="Profile durchsuchen"></label>
        <select data-sort aria-label="Sortierung"><option value="updated">Zuletzt aktualisiert</option><option value="name">Name A–Z</option></select>
      </div>
    </div>
    ${cards.length ? `<ul class="grid" data-grid>${cards.join('')}</ul>` : ''}
    <p class="empty" data-empty ${cards.length ? 'hidden' : ''}>${cards.length ? 'Niemand gefunden.' : 'Noch keine Profile – sei die erste Person mit <code>/profil bearbeiten</code>!'}</p>
  </section>
</main>
${footer(site)}`;

  return layout({
    title: `${site.name} · Profile`,
    description: `Die Mitglieder-Profile von ${site.name}.`,
    bodyClass: 'page-site',
    styles: ['/static/css/fonts.css', '/static/css/site.css'],
    scripts: ['/static/js/directory.js'],
    body,
  });
}

// ---------------------------------------------------------------- Login-Bestätigung
export function loginPage({ site, token, name, avatar, minutesLeft }) {
  const img = safeImageUrl(avatar);
  const body = `${topbar(site)}
<main class="center">
  <form class="panel login" method="post" action="/login">
    <div class="login-avatar">${img ? `<img src="${esc(img)}" alt="" referrerpolicy="no-referrer">` : `<span>${esc(Array.from(name)[0]?.toUpperCase() ?? '?')}</span>`}</div>
    <h1>Hey ${esc(name)}! 👋</h1>
    <p>Bereit, dein Profil zu gestalten? Mit dem Klick meldest du dich in diesem Browser an.</p>
    <input type="hidden" name="token" value="${esc(token)}">
    <button class="btn btn-primary btn-lg" type="submit" autofocus>${uiIcon('pencil')}<span>Zum Profil-Editor</span></button>
    <p class="muted small">Der Link ist noch ${minutesLeft} ${minutesLeft === 1 ? 'Minute' : 'Minuten'} gültig und funktioniert nur einmal. Teil ihn mit niemandem.</p>
  </form>
</main>`;
  return layout({ title: `Anmelden · ${site.name}`, bodyClass: 'page-site', styles: ['/static/css/fonts.css', '/static/css/site.css'], body });
}

// ---------------------------------------------------------------- Meldungen (404, Fehler, …)
/** `html` ist VERTRAUENSWÜRDIGES Markup aus dem Code – niemals Nutzerdaten hineinreichen! */
export function messagePage({ site, title, html, emoji = '🤔', actions = [] }) {
  const body = `${topbar(site)}
<main class="center">
  <div class="panel message">
    <div class="message-emoji" aria-hidden="true">${esc(emoji)}</div>
    <h1>${esc(title)}</h1>
    <p>${html}</p>
    ${actions.length ? `<div class="message-actions">${actions.map((a) => `<a class="btn ${a.primary ? 'btn-primary' : 'btn-ghost'}" href="${esc(a.href)}">${esc(a.label)}</a>`).join('')}</div>` : ''}
  </div>
</main>`;
  return layout({ title: `${title} · ${site.name}`, bodyClass: 'page-site', styles: ['/static/css/fonts.css', '/static/css/site.css'], body });
}

// ---------------------------------------------------------------- Vorschau-Rahmen für den Editor
export function previewFramePage() {
  return layout({
    title: 'Vorschau',
    bodyClass: 'page-profile page-preview',
    styles: ['/static/css/fonts.css', '/static/css/profile.css'],
    scripts: ['/static/js/preview.js'],
    body: '<div id="preview-root"></div>',
  });
}
