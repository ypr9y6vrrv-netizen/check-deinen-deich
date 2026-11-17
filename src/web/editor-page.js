// Markup des Profil-Editors. Die Werte füllt public/js/editor.js aus den eingebetteten Daten.
import { esc, safeImageUrl } from '../shared/render.js';
import { uiIcon } from '../shared/ui-icons.js';
import {
  OPTIONS, FONTS, EFFECTS, NAME_EFFECTS, CARD_STYLES, BG_TYPES, BANNERS, AVATAR_SHAPES, LINK_STYLES, TONES, PRESETS, LIMITS,
} from '../shared/profile.js';
import { layout, jsonForScript } from './pages.js';

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function segmented(path, options, { cls = '' } = {}) {
  return `<div class="seg ${cls}" role="radiogroup">${Object.entries(options)
    .map(([value, label]) => `<label class="seg-opt"><input type="radio" name="${esc(path)}" value="${esc(value)}" data-bind="${esc(path)}"><span>${esc(typeof label === 'string' ? label : label.label)}</span></label>`)
    .join('')}</div>`;
}

function toggle(path, label, hint = '') {
  return `<label class="toggle"><input type="checkbox" data-bind="${esc(path)}"><span class="toggle-ui" aria-hidden="true"></span><span class="toggle-text">${esc(label)}${hint ? `<small>${esc(hint)}</small>` : ''}</span></label>`;
}

function field(label, control, { hint = '', counter = '', id = '' } = {}) {
  return `<div class="field">
  <div class="field-head"><label${id ? ` for="${id}"` : ''}>${esc(label)}</label>${counter ? `<span class="counter" data-counter="${esc(counter)}"></span>` : ''}</div>
  ${control}
  ${hint ? `<p class="hint">${hint}</p>` : ''}
</div>`;
}

function colorInput(path, label) {
  return `<label class="color"><input type="color" data-bind="${esc(path)}"><span class="color-text"><small>${esc(label)}</small><input type="text" class="color-hex" data-hex-for="${esc(path)}" maxlength="7" spellcheck="false" aria-label="${esc(label)} als Hex-Code"></span></label>`;
}

function range(path, label, min, max, unit = '') {
  return `<label class="range"><span class="range-head"><span>${esc(label)}</span><output data-out="${esc(path)}" data-unit="${esc(unit)}"></output></span><input type="range" min="${min}" max="${max}" data-bind="${esc(path)}"></label>`;
}

function uploader(kind, path, label) {
  return `<div class="uploader" data-uploader="${kind}" data-path="${esc(path)}">
  <div class="uploader-preview" data-upload-preview></div>
  <div class="uploader-body">
    <label class="btn btn-ghost btn-sm">${uiIcon('upload')}<span>${esc(label)}</span><input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" hidden data-upload-input></label>
    <button type="button" class="btn btn-ghost btn-sm" data-upload-remove>${uiIcon('trash')}<span>Entfernen</span></button>
    <p class="hint">PNG, JPG, GIF (animiert!) oder WebP, max. <span data-max-mb></span> MB. Standortdaten werden automatisch entfernt.</p>
    <p class="upload-status" data-upload-status></p>
  </div>
</div>`;
}

export function editorPage({ site, profile, discord, presence, publicUrl, maxUploadMb, demo = false }) {
  const host = publicUrl.replace(/^https?:\/\//, '');
  const icon = safeImageUrl(site.iconUrl);

  const presets = Object.entries(PRESETS)
    .map(([key, p]) => `<button type="button" class="preset" data-preset="${key}" style="--p1:${p.bg1};--p2:${p.bg2};--pa:${p.accent}" title="${esc(p.label)}"><span class="preset-swatch"><i></i></span><span>${esc(p.label)}</span></button>`)
    .join('');

  const fonts = Object.entries(FONTS)
    .map(([key, f]) => `<label class="choice choice-font"><input type="radio" name="theme.font" value="${key}" data-bind="theme.font"><span class="choice-card"><span class="font-sample" style="font-family:${esc(f.css)};font-weight:${f.weight};font-size:${(1.35 * f.scale).toFixed(2)}rem">Aa</span><span>${esc(f.label)}</span></span></label>`)
    .join('');

  const effects = Object.entries(EFFECTS)
    .map(([key, e]) => `<label class="choice"><input type="radio" name="theme.effect" value="${key}" data-bind="theme.effect"><span class="choice-card"><span class="choice-emoji">${e.emoji}</span><span>${esc(e.label)}</span></span></label>`)
    .join('');

  const nameFx = Object.entries(NAME_EFFECTS)
    .map(([key, label]) => `<label class="choice"><input type="radio" name="theme.nameEffect" value="${key}" data-bind="theme.nameEffect"><span class="choice-card"><span class="name-sample name-sample--${key}" data-text="Name">Name</span><span>${esc(label)}</span></span></label>`)
    .join('');

  const cardStyles = Object.entries(CARD_STYLES)
    .map(([key, label]) => `<label class="choice"><input type="radio" name="theme.cardStyle" value="${key}" data-bind="theme.cardStyle"><span class="choice-card"><span class="card-sample card-sample--${key}"></span><span>${esc(label)}</span></span></label>`)
    .join('');

  const days = Array.from({ length: 31 }, (_, i) => `<option value="${String(i + 1).padStart(2, '0')}">${i + 1}.</option>`).join('');
  const months = MONTHS.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m}</option>`).join('');

  const initial = {
    profile,
    discord: discord ?? {},
    presence: presence ?? null,
    site,
    publicUrl,
    maxUploadMb,
    options: OPTIONS,
  };

  const body = `<div class="ed" data-tab-current="profil">
<header class="ed-top">
  <a class="brand" href="/">${icon ? `<img src="${esc(icon)}" alt="">` : `<span class="brand-mark">${uiIcon('sparkle')}</span>`}<span>${esc(site.name)}</span></a>
  <div class="ed-url" title="Dein Profil-Link">
    ${uiIcon('link')}<span class="ed-url-text">${esc(host)}/<b data-slug-label>${esc(profile.slug)}</b></span>
    <button type="button" class="btn btn-sm btn-primary" data-copy-link>${uiIcon('copy')}<span>Link kopieren</span></button>
  </div>
  <div class="ed-top-actions">
    <a class="btn btn-ghost btn-sm" href="/${esc(profile.slug)}" target="_blank" rel="noopener" data-view-link>${uiIcon('external')}<span>Ansehen</span></a>
    <form method="post" action="/logout"><button class="btn btn-ghost btn-sm" type="submit" title="Abmelden">${uiIcon('logout')}<span class="hide-sm">Abmelden</span></button></form>
  </div>
</header>

${profile.hidden ? `<div class="ed-alert ed-alert--danger">${uiIcon('lock')}<span>Dein Profil wurde von der Moderation <b>ausgeblendet</b> und ist gerade für niemanden sichtbar. Melde dich bei den Mods, wenn du denkst, dass das ein Fehler ist.</span></div>` : ''}
${demo ? `<div class="ed-alert">${uiIcon('info')}<span><b>Demo-Modus:</b> Kein echter Discord verbunden – alles hier ist zum Ausprobieren.</span></div>` : ''}

<div class="ed-mtabs" role="tablist" aria-label="Ansicht">
  <button type="button" data-mview="edit" aria-pressed="true">${uiIcon('pencil')}<span>Bearbeiten</span></button>
  <button type="button" data-mview="preview" aria-pressed="false">${uiIcon('eye')}<span>Vorschau</span></button>
</div>

<div class="ed-main" data-mview-current="edit">
  <aside class="ed-panel">
    <nav class="ed-tabs" role="tablist" aria-label="Bereiche">
      <button type="button" role="tab" data-tab="profil">${uiIcon('user')}<span>Profil</span></button>
      <button type="button" role="tab" data-tab="links">${uiIcon('link')}<span>Links</span></button>
      <button type="button" role="tab" data-tab="design">${uiIcon('palette')}<span>Design</span></button>
      <button type="button" role="tab" data-tab="effekte">${uiIcon('wand')}<span>Effekte</span></button>
      <button type="button" role="tab" data-tab="privat">${uiIcon('lock')}<span>Privat</span></button>
    </nav>

    <div class="ed-sections">
      <!-- ============================== PROFIL -->
      <section class="ed-section" data-panel="profil">
        <h2>Über dich</h2>
        ${field('Anzeigename', `<input id="f-name" type="text" data-bind="displayName" maxlength="${LIMITS.displayName}" placeholder="${esc(discord?.displayName ?? '')}">`, { hint: 'Leer lassen = dein Name auf dem Server.', counter: 'displayName', id: 'f-name' })}
        ${field('Status-Zeile', `<input id="f-tagline" type="text" data-bind="tagline" maxlength="${LIMITS.tagline}" placeholder="z. B. Valorant-Main · Nachteule 🦉">`, { hint: 'Steht groß unter deinem Namen. Tipp: Unter „Effekte“ gibt’s eine Schreibmaschinen-Animation dafür.', counter: 'tagline', id: 'f-tagline' })}
        ${field('Über mich', `<textarea id="f-bio" data-bind="bio" rows="6" maxlength="${LIMITS.bio}" placeholder="Erzähl was über dich – Hobbys, Lieblingsspiele, was dich ausmacht …"></textarea>`, { counter: 'bio', id: 'f-bio' })}
        <div class="grid-2">
          ${field('Pronomen', `<input id="f-pronouns" type="text" data-bind="pronouns" maxlength="${LIMITS.pronouns}" list="pronoun-list" placeholder="z. B. er/ihm">
          <datalist id="pronoun-list"><option value="er/ihm"><option value="sie/ihr"><option value="they/them"><option value="er/sie"><option value="keine Pronomen, nur Name"></datalist>`, { id: 'f-pronouns' })}
          ${field('Ort', `<input id="f-location" type="text" data-bind="location" maxlength="${LIMITS.location}" placeholder="z. B. Essen, NRW">`, { id: 'f-location' })}
        </div>
        ${field('Geburtstag', `<div class="bday"><select data-bday="day" aria-label="Tag"><option value="">Tag</option>${days}</select><select data-bday="month" aria-label="Monat"><option value="">Monat</option>${months}</select><button type="button" class="btn btn-ghost btn-sm" data-bday-clear>${uiIcon('x')}<span>Leeren</span></button></div>`, { hint: 'Ohne Jahr – dein Alter bleibt privat. An deinem Geburtstag gibt’s einen 🎂 auf dem Profil.' })}

        <h2>Interessen</h2>
        <div class="tags-input" data-tags>
          <ul class="tags-list" data-tags-list></ul>
          <input type="text" data-tags-entry maxlength="${LIMITS.tag}" placeholder="Interesse eingeben + Enter (z. B. Gaming, Anime, Fußball)">
        </div>
        <p class="hint">Bis zu ${LIMITS.tagCount} Stück.</p>

        <h2>Eigene Infos</h2>
        <p class="hint">Alles, was du sonst noch zeigen willst – z. B. <i>Main-Game: Valorant</i>, <i>Rang: Diamond 2</i>, <i>Setup: PS5</i>.</p>
        <ul class="rows" data-fields></ul>
        <button type="button" class="btn btn-ghost btn-sm" data-add-field>${uiIcon('plus')}<span>Info hinzufügen</span></button>
      </section>

      <!-- ============================== LINKS -->
      <section class="ed-section" data-panel="links" hidden>
        <h2>Deine Links</h2>
        <p class="hint">Instagram, TikTok, YouTube, Twitch, Steam, Spotify &amp; Co. werden automatisch erkannt.</p>
        <ul class="rows" data-links></ul>
        <button type="button" class="btn btn-ghost btn-sm" data-add-link>${uiIcon('plus')}<span>Link hinzufügen</span></button>
        ${field('Darstellung', segmented('theme.linkStyle', LINK_STYLES))}

        <h2>Lieblingssong</h2>
        ${field('Spotify-, YouTube- oder SoundCloud-Link', `<input type="url" id="f-song" data-bind="song" placeholder="https://open.spotify.com/track/…" inputmode="url">`, { hint: 'Wird erst geladen, wenn jemand auf „Abspielen“ klickt – ohne Klick keine Daten an Spotify/YouTube.', id: 'f-song' })}
        <p class="field-error" data-song-error hidden>Den Link erkenne ich nicht – nimm einen Spotify-, YouTube- oder SoundCloud-Link.</p>
      </section>

      <!-- ============================== DESIGN -->
      <section class="ed-section" data-panel="design" hidden>
        <h2>Vorlagen</h2>
        <div class="presets">${presets}</div>

        <h2>Farben</h2>
        <div class="grid-2">
          ${colorInput('theme.accent', 'Akzentfarbe')}
          <div class="field">${segmented('theme.tone', TONES)}<p class="hint">Hell oder dunkel – für Karte &amp; Schrift.</p></div>
        </div>

        <h2>Hintergrund</h2>
        ${segmented('theme.bgType', BG_TYPES)}
        <div class="sub" data-show-if="theme.bgType=gradient,solid">
          <div class="grid-2">
            ${colorInput('theme.bg1', 'Farbe 1')}
            <div data-show-if="theme.bgType=gradient">${colorInput('theme.bg2', 'Farbe 2')}</div>
          </div>
          <div data-show-if="theme.bgType=gradient">
            ${range('theme.bgAngle', 'Winkel', 0, 360, '°')}
            ${toggle('theme.bgAnimate', 'Animierte Farbwolken', 'Lässt den Hintergrund sanft „atmen“.')}
          </div>
        </div>
        <div class="sub" data-show-if="theme.bgType=image">
          ${uploader('background', 'theme.bgImage', 'Hintergrundbild wählen')}
        </div>
        <div class="sub">
          <div data-show-if="theme.bgType=image">${range('theme.bgBlur', 'Unschärfe', 0, 20, 'px')}</div>
          ${range('theme.bgDim', 'Abdunkeln', 0, 85, '%')}
        </div>

        <h2>Banner</h2>
        ${segmented('theme.banner', BANNERS)}
        <p class="hint" data-banner-hint></p>
        <div class="sub" data-show-if="theme.banner=image">
          ${uploader('banner', 'theme.bannerImage', 'Banner wählen')}
        </div>

        <h2>Karte</h2>
        <div class="choices choices-4">${cardStyles}</div>
        ${field('Avatar-Form', segmented('theme.avatarShape', AVATAR_SHAPES))}

        <h2>Schrift für deinen Namen</h2>
        <div class="choices choices-4">${fonts}</div>
      </section>

      <!-- ============================== EFFEKTE -->
      <section class="ed-section" data-panel="effekte" hidden>
        <h2>Hintergrund-Effekt</h2>
        <div class="choices choices-3">${effects}</div>
        <h2>Namens-Effekt</h2>
        <div class="choices choices-3">${nameFx}</div>
        <h2>Animationen</h2>
        ${toggle('theme.typewriter', 'Schreibmaschine', 'Deine Status-Zeile tippt sich selbst.')}
        ${toggle('theme.tilt', '3D-Neigung', 'Die Karte neigt sich mit der Maus.')}
        <p class="hint">Besucher, die in ihrem System „Bewegung reduzieren“ eingestellt haben, sehen keine Animationen.</p>
      </section>

      <!-- ============================== PRIVATSPHÄRE -->
      <section class="ed-section" data-panel="privat" hidden>
        <h2>Deine Adresse</h2>
        ${field('Profil-Link', `<div class="slug"><span class="slug-prefix">${esc(host)}/</span><input id="f-slug" type="text" data-bind="slug" maxlength="${LIMITS.slugMax}" spellcheck="false" autocapitalize="off" autocomplete="off"></div>`, { hint: '<span data-slug-status></span>', id: 'f-slug' })}

        <h2>Sichtbarkeit</h2>
        ${toggle('published', 'Profil ist öffentlich', 'Aus = nur du siehst es (eingeloggt).')}
        ${toggle('listed', 'In der Mitgliederliste zeigen', 'Aus = nur wer deinen Link hat, findet dich.')}

        <h2>Was von Discord angezeigt wird</h2>
        ${toggle('show.username', '@Nutzername')}
        ${toggle('show.roles', 'Server-Rollen')}
        ${toggle('show.joined', 'Seit wann du auf dem Server bist')}
        ${toggle('show.created', 'Seit wann du bei Discord bist')}
        ${toggle('show.status', 'Online-Status & Custom-Status')}
        ${toggle('show.activity', 'Aktivität', 'z. B. „Spielt Valorant“ oder „Hört … auf Spotify“.')}
        ${toggle('show.views', 'Aufrufe-Zähler')}
        <div class="sync">
          <p class="hint">Avatar, Banner, Name &amp; Rollen holt der Bot automatisch von Discord. Gerade erst geändert?</p>
          <button type="button" class="btn btn-ghost btn-sm" data-refresh-discord>${uiIcon('refresh')}<span>Discord-Daten jetzt neu laden</span></button>
        </div>

        <div class="danger">
          <h2>Gefahrenzone</h2>
          <p class="hint">Löscht dein Profil, deine Bilder und deinen Link endgültig. Mit <code>/profil bearbeiten</code> kannst du später ein neues anlegen.</p>
          <button type="button" class="btn btn-danger btn-sm" data-delete-profile>${uiIcon('trash')}<span>Profil löschen</span></button>
        </div>
      </section>
    </div>
  </aside>

  <section class="ed-preview" aria-label="Live-Vorschau">
    <div class="ed-preview-bar">
      <span class="live-dot" aria-hidden="true"></span><span>Live-Vorschau</span>
      <div class="device" role="group" aria-label="Gerät">
        <button type="button" data-device="desktop" aria-pressed="true" title="Desktop">${uiIcon('monitor')}</button>
        <button type="button" data-device="mobile" aria-pressed="false" title="Handy">${uiIcon('phone')}</button>
      </div>
    </div>
    <div class="ed-frame-wrap" data-device-current="desktop">
      <iframe class="ed-frame" src="/edit/preview" title="Vorschau deines Profils"></iframe>
    </div>
  </section>
</div>

<div class="savebar" data-savebar>
  <span class="savebar-status" data-save-status>Alles gespeichert</span>
  <button type="button" class="btn btn-ghost btn-sm" data-discard hidden>Verwerfen</button>
  <button type="button" class="btn btn-primary" data-save disabled>${uiIcon('save')}<span>Speichern</span></button>
</div>
<div class="toast" data-toast role="status" aria-live="polite"></div>
</div>
<script type="application/json" id="ed-data">${jsonForScript(initial)}</script>`;

  return layout({
    title: `Profil bearbeiten · ${site.name}`,
    bodyClass: 'page-editor',
    styles: ['/static/css/fonts.css', '/static/css/site.css', '/static/css/editor.css'],
    scripts: ['/static/js/editor.js'],
    body,
  });
}
