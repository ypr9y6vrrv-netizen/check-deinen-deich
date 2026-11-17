// Profil-Editor: Formular ↔ Zustand, Live-Vorschau, Uploads, Speichern.
import {
  sanitizeProfile, detectPlatform, normalizeUrl, parseSong, validateSlug, defaultLinkLabel, cleanText, PRESETS, LIMITS,
} from '/shared/profile.js';
import { brandIcon } from '/shared/render.js';
import { uiIcon } from '/shared/ui-icons.js';

const data = JSON.parse(document.getElementById('ed-data').textContent);
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const clone = (v) => JSON.parse(JSON.stringify(v));
const host = data.publicUrl.replace(/^https?:\/\//, '');

let saved = data.profile;
let state = clone(saved);
let discord = data.discord ?? {};
let presence = data.presence;
let saving = false;

// ------------------------------------------------------------------ Pfad-Helfer
const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], obj)[last] = value;
}

// ------------------------------------------------------------------ Toast
let toastTimer = 0;
function toast(msg, type = 'ok') {
  const el = $('[data-toast]');
  el.textContent = msg;
  el.classList.toggle('is-error', type === 'error');
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), type === 'error' ? 5000 : 3200);
}

// ------------------------------------------------------------------ Vorschau
const frame = $('.ed-frame');
let previewReady = false;
let previewQueued = false;
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.source !== frame.contentWindow) return;
  if (e.data?.type === 'preview-ready') {
    previewReady = true;
    sendPreview();
  }
});
function sendPreview() {
  if (!previewReady) return;
  frame.contentWindow.postMessage({
    type: 'render',
    payload: { profile: sanitizeProfile(state, saved), discord, presence, site: data.site, now: Date.now() },
  }, location.origin);
}
function schedulePreview() {
  if (previewQueued) return;
  previewQueued = true;
  setTimeout(() => {
    previewQueued = false;
    sendPreview();
  }, 70);
}

// ------------------------------------------------------------------ Änderungen & Speichern-Leiste
function isDirty() {
  return JSON.stringify(sanitizeProfile(state, saved)) !== JSON.stringify(saved);
}
function updateSavebar() {
  const dirty = isDirty();
  const bar = $('[data-savebar]');
  bar.classList.toggle('is-dirty', dirty);
  $('[data-save]').disabled = !dirty || saving;
  $('[data-discard]').hidden = !dirty || saving;
  $('[data-save-status]').textContent = saving ? 'Speichert …' : dirty ? 'Ungespeicherte Änderungen' : 'Alles gespeichert';
}

function afterChange(path) {
  syncDerived();
  if (path === 'slug') checkSlug();
  if (path === 'song') syncSongError();
  updateSavebar();
  schedulePreview();
}

// ------------------------------------------------------------------ Eingaben binden
function readInput(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.type === 'range') return Number(el.value);
  return el.value;
}
function writeInput(el, value) {
  if (el.type === 'checkbox') el.checked = Boolean(value);
  else if (el.type === 'radio') el.checked = el.value === value;
  else if (el !== document.activeElement && el.value !== String(value ?? '')) el.value = value ?? '';
}

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.matches('[data-bind]')) {
    if (el.type === 'radio' && !el.checked) return;
    setPath(state, el.dataset.bind, readInput(el));
    afterChange(el.dataset.bind);
  } else if (el.matches('[data-hex-for]')) {
    const v = el.value.trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) {
      setPath(state, el.dataset.hexFor, v.toLowerCase());
      $(`input[type=color][data-bind="${el.dataset.hexFor}"]`).value = v.toLowerCase();
      afterChange(el.dataset.hexFor);
    }
  } else if (el.matches('[data-link-url], [data-link-label]')) {
    const i = Number(el.dataset.linkUrl ?? el.dataset.linkLabel);
    if (!state.links[i]) return;
    if (el.matches('[data-link-url]')) {
      state.links[i].url = el.value;
      updateLinkRow(i);
    } else {
      state.links[i].label = el.value;
    }
    afterChange('links');
  } else if (el.matches('[data-field-label], [data-field-value]')) {
    const i = Number(el.dataset.fieldLabel ?? el.dataset.fieldValue);
    if (!state.fields[i]) return;
    state.fields[i][el.matches('[data-field-label]') ? 'label' : 'value'] = el.value;
    afterChange('fields');
  }
});

function syncInputs() {
  for (const el of $$('[data-bind]')) writeInput(el, getPath(state, el.dataset.bind));
  syncBirthday();
  renderTags();
  renderFields();
  renderLinks();
  syncDerived();
  syncSongError();
}

/** Alles, was von anderen Werten abhängt (Anzeigen, Sichtbarkeit, Zähler …). */
function syncDerived() {
  for (const el of $$('[data-hex-for]')) {
    if (el !== document.activeElement) el.value = getPath(state, el.dataset.hexFor) ?? '';
  }
  for (const el of $$('[data-out]')) el.textContent = `${getPath(state, el.dataset.out)}${el.dataset.unit}`;
  for (const el of $$('[data-show-if]')) {
    const [path, values] = el.dataset.showIf.split('=');
    el.hidden = !values.split(',').includes(String(getPath(state, path)));
  }
  for (const el of $$('[data-counter]')) {
    const key = el.dataset.counter;
    const len = Array.from(String(state[key] ?? '')).length;
    el.textContent = `${len} / ${LIMITS[key]}`;
    el.classList.toggle('is-full', len >= LIMITS[key]);
  }
  for (const btn of $$('[data-preset]')) {
    const p = PRESETS[btn.dataset.preset];
    const t = state.theme;
    btn.classList.toggle('is-active', p.accent === t.accent && p.bg1 === t.bg1 && p.bg2 === t.bg2);
  }
  syncUploaders();
  const bannerHint = $('[data-banner-hint]');
  bannerHint.textContent = state.theme.banner === 'discord' && !discord.banner
    ? 'Du hast kein Discord-Banner (gibt’s mit Nitro) – stattdessen wird ein Verlauf in deiner Akzentfarbe gezeigt.'
    : '';
  bannerHint.hidden = !bannerHint.textContent;
  $('[data-add-link]').disabled = state.links.length >= LIMITS.linkCount;
  $('[data-add-field]').disabled = state.fields.length >= LIMITS.fieldCount;
}

// ------------------------------------------------------------------ Geburtstag
function syncBirthday() {
  const [month = '', day = ''] = state.birthday ? state.birthday.split('-') : [];
  $('[data-bday="day"]').value = day;
  $('[data-bday="month"]').value = month;
}
for (const sel of $$('[data-bday]')) {
  sel.addEventListener('change', () => {
    const day = $('[data-bday="day"]').value;
    const month = $('[data-bday="month"]').value;
    state.birthday = day && month ? `${month}-${day}` : '';
    afterChange('birthday');
  });
}
$('[data-bday-clear]').addEventListener('click', () => {
  state.birthday = '';
  syncBirthday();
  afterChange('birthday');
});

// ------------------------------------------------------------------ Interessen (Tags)
const tagsEntry = $('[data-tags-entry]');
function renderTags() {
  $('[data-tags-list]').innerHTML = state.tags
    .map((t, i) => `<li class="tag-chip"><span>${escapeHtml(t)}</span><button type="button" data-tag-remove="${i}" aria-label="${escapeHtml(t)} entfernen">${uiIcon('x')}</button></li>`)
    .join('');
  tagsEntry.disabled = state.tags.length >= LIMITS.tagCount;
  tagsEntry.placeholder = tagsEntry.disabled ? 'Maximum erreicht' : 'Interesse eingeben + Enter (z. B. Gaming, Anime, Fußball)';
}
function addTag(raw) {
  const tag = cleanText(raw, LIMITS.tag).replace(/^#+/, '');
  if (!tag) return;
  if (state.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return toast('Das Interesse hast du schon drin.');
  if (state.tags.length >= LIMITS.tagCount) return;
  state.tags.push(tag);
  renderTags();
  afterChange('tags');
}
tagsEntry.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    addTag(tagsEntry.value);
    tagsEntry.value = '';
  } else if (e.key === 'Backspace' && !tagsEntry.value && state.tags.length) {
    state.tags.pop();
    renderTags();
    afterChange('tags');
  }
});
tagsEntry.addEventListener('blur', () => {
  if (tagsEntry.value.trim()) {
    addTag(tagsEntry.value);
    tagsEntry.value = '';
  }
});
$('[data-tags]').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tag-remove]');
  if (btn) {
    state.tags.splice(Number(btn.dataset.tagRemove), 1);
    renderTags();
    afterChange('tags');
  } else if (e.target === e.currentTarget || e.target.matches('[data-tags-list]')) {
    tagsEntry.focus();
  }
});

// ------------------------------------------------------------------ Eigene Infos
function rowActions(kind, i, len) {
  return `<div class="row-actions">
    <button type="button" class="icon-btn" data-${kind}-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Nach oben">${uiIcon('up')}</button>
    <button type="button" class="icon-btn" data-${kind}-move="${i}" data-dir="1" ${i === len - 1 ? 'disabled' : ''} aria-label="Nach unten">${uiIcon('down')}</button>
    <button type="button" class="icon-btn icon-btn--danger" data-${kind}-remove="${i}" aria-label="Entfernen">${uiIcon('trash')}</button>
  </div>`;
}
function renderFields() {
  $('[data-fields]').innerHTML = state.fields
    .map((f, i) => `<li class="row row--field">
      <div class="row-inputs">
        <input type="text" data-field-label="${i}" value="${escapeHtml(f.label)}" maxlength="${LIMITS.fieldLabel}" placeholder="z. B. Main-Game" aria-label="Bezeichnung">
        <input type="text" data-field-value="${i}" value="${escapeHtml(f.value)}" maxlength="${LIMITS.fieldValue}" placeholder="z. B. Valorant" aria-label="Wert">
      </div>
      ${rowActions('field', i, state.fields.length)}
    </li>`)
    .join('');
}
$('[data-add-field]').addEventListener('click', () => {
  if (state.fields.length >= LIMITS.fieldCount) return;
  state.fields.push({ label: '', value: '' });
  renderFields();
  afterChange('fields');
  $(`[data-field-label="${state.fields.length - 1}"]`).focus();
});
$('[data-fields]').addEventListener('click', (e) => listAction(e, 'field', state.fields, renderFields));

// ------------------------------------------------------------------ Links
function linkIcon(url) {
  const normalized = normalizeUrl(url);
  return normalized ? brandIcon(detectPlatform(normalized)) : uiIcon('link');
}
function renderLinks() {
  $('[data-links]').innerHTML = state.links
    .map((l, i) => `<li class="row" data-link-row="${i}">
      <div class="row-icon" data-link-icon>${linkIcon(l.url)}</div>
      <div class="row-inputs">
        <input type="url" inputmode="url" data-link-url="${i}" value="${escapeHtml(l.url)}" maxlength="${LIMITS.url}" placeholder="https://instagram.com/deinname" aria-label="Link-Adresse">
        <input type="text" data-link-label="${i}" value="${escapeHtml(l.label)}" maxlength="${LIMITS.linkLabel}" aria-label="Beschriftung">
      </div>
      ${rowActions('link', i, state.links.length)}
    </li>`)
    .join('');
  state.links.forEach((_, i) => updateLinkRow(i));
}
function updateLinkRow(i) {
  const row = $(`[data-link-row="${i}"]`);
  if (!row) return;
  const url = state.links[i].url;
  const normalized = normalizeUrl(url);
  row.querySelector('[data-link-icon]').innerHTML = linkIcon(url);
  row.classList.toggle('is-invalid', Boolean(url.trim()) && !normalized);
  row.querySelector('[data-link-label]').placeholder = normalized ? `Beschriftung (Standard: ${defaultLinkLabel(normalized)})` : 'Beschriftung (optional)';
}
$('[data-add-link]').addEventListener('click', () => {
  if (state.links.length >= LIMITS.linkCount) return;
  state.links.push({ url: '', label: '' });
  renderLinks();
  afterChange('links');
  $(`[data-link-url="${state.links.length - 1}"]`).focus();
});
$('[data-links]').addEventListener('click', (e) => listAction(e, 'link', state.links, renderLinks));

function listAction(e, kind, list, rerender) {
  const move = e.target.closest(`[data-${kind}-move]`);
  const remove = e.target.closest(`[data-${kind}-remove]`);
  if (move) {
    const i = Number(move.dataset[`${kind}Move`]);
    const j = i + Number(move.dataset.dir);
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
  } else if (remove) {
    list.splice(Number(remove.dataset[`${kind}Remove`]), 1);
  } else {
    return;
  }
  rerender();
  afterChange(kind === 'link' ? 'links' : 'fields');
}

function syncSongError() {
  const url = normalizeUrl(state.song);
  $('[data-song-error]').hidden = !state.song.trim() || Boolean(url && parseSong(url));
}

// ------------------------------------------------------------------ Vorlagen
for (const btn of $$('[data-preset]')) {
  btn.addEventListener('click', () => {
    const p = PRESETS[btn.dataset.preset];
    Object.assign(state.theme, { accent: p.accent, bg1: p.bg1, bg2: p.bg2, tone: p.tone });
    if (state.theme.bgType === 'solid') state.theme.bgType = 'gradient';
    syncInputs();
    afterChange('theme');
  });
}

// ------------------------------------------------------------------ Uploads
function syncUploaders() {
  for (const up of $$('[data-uploader]')) {
    const url = getPath(state, up.dataset.path);
    const preview = $('[data-upload-preview]', up);
    preview.style.backgroundImage = url ? `url("${url}")` : '';
    preview.innerHTML = url ? '' : uiIcon('image');
    $('[data-upload-remove]', up).hidden = !url;
    $('[data-max-mb]', up).textContent = data.maxUploadMb;
  }
}
for (const up of $$('[data-uploader]')) {
  const input = $('[data-upload-input]', up);
  const status = $('[data-upload-status]', up);
  const setStatus = (msg, isError = false) => {
    status.textContent = msg;
    status.classList.toggle('is-error', isError);
  };
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g|gif|webp|avif)$/.test(file.type)) return setStatus('Bitte ein PNG, JPG, GIF oder WebP nehmen.', true);
    if (file.size > data.maxUploadMb * 1024 * 1024) return setStatus(`Die Datei ist zu groß (max. ${data.maxUploadMb} MB).`, true);
    setStatus('Lädt hoch …');
    up.classList.add('is-busy');
    try {
      const res = await fetch(`/api/me/upload?kind=${up.dataset.uploader}`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Upload fehlgeschlagen.');
      setPath(state, up.dataset.path, body.url);
      if (up.dataset.uploader === 'background') state.theme.bgType = 'image';
      if (up.dataset.uploader === 'banner') state.theme.banner = 'image';
      setStatus(body.animated ? 'Fertig – animiert! 🎉 Vergiss nicht zu speichern.' : 'Fertig! Vergiss nicht zu speichern.');
      syncInputs();
      afterChange('theme');
    } catch (err) {
      setStatus(err.message || 'Upload fehlgeschlagen.', true);
    } finally {
      up.classList.remove('is-busy');
    }
  });
  $('[data-upload-remove]', up).addEventListener('click', () => {
    setPath(state, up.dataset.path, '');
    if (up.dataset.uploader === 'background' && state.theme.bgType === 'image') state.theme.bgType = 'gradient';
    if (up.dataset.uploader === 'banner' && state.theme.banner === 'image') state.theme.banner = 'discord';
    setStatus('');
    syncInputs();
    afterChange('theme');
  });
}

// ------------------------------------------------------------------ Profil-Adresse
let slugTimer = 0;
let slugSeq = 0;
function setSlugStatus(text, ok) {
  const el = $('[data-slug-status]');
  el.textContent = text;
  el.className = ok === true ? 'slug-ok' : ok === false ? 'slug-bad' : '';
}
function checkSlug() {
  clearTimeout(slugTimer);
  const slug = String(state.slug ?? '').trim().toLowerCase();
  if (slug === saved.slug) return setSlugStatus(`Deine aktuelle Adresse: ${host}/${saved.slug}`);
  const local = validateSlug(slug);
  if (local) return setSlugStatus(local, false);
  setSlugStatus('Prüfe …');
  const seq = ++slugSeq;
  slugTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/slug?slug=${encodeURIComponent(slug)}`);
      const body = await res.json();
      if (seq !== slugSeq) return;
      setSlugStatus(body.available ? `✓ ${host}/${slug} ist frei – nach dem Speichern den neuen Link in deine Discord-Bio packen!` : body.error, body.available);
    } catch {
      if (seq === slugSeq) setSlugStatus('Konnte nicht prüfen – du kannst trotzdem speichern.');
    }
  }, 350);
}

function updateUrlBits() {
  $('[data-slug-label]').textContent = saved.slug;
  $('[data-view-link]').href = `/${saved.slug}`;
}

// ------------------------------------------------------------------ Speichern
async function save() {
  if (saving || !isDirty()) return;
  saving = true;
  updateSavebar();
  const linksBefore = state.links.filter((l) => l.url.trim()).length;
  try {
    const res = await fetch('/api/me/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ profile: state }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) {
      toast('Deine Sitzung ist abgelaufen – hol dir im Discord mit /profil bearbeiten einen neuen Link.', 'error');
      return;
    }
    if (!res.ok) {
      if (body.field === 'slug') {
        switchTab('privat');
        setSlugStatus(body.error, false);
      }
      toast(body.error || 'Speichern hat nicht geklappt.', 'error');
      return;
    }
    const slugChanged = body.profile.slug !== saved.slug;
    saved = body.profile;
    state = clone(saved);
    syncInputs();
    updateUrlBits();
    checkSlug();
    const dropped = linksBefore - saved.links.length;
    if (slugChanged) toast(`Gespeichert ✓ Neue Adresse: ${host}/${saved.slug} – aktualisier den Link in deiner Discord-Bio!`);
    else toast(dropped > 0 ? `Gespeichert ✓ (${dropped} ungültige${dropped === 1 ? 'r' : ''} Link${dropped === 1 ? '' : 's'} ignoriert)` : 'Gespeichert ✓');
  } catch {
    toast('Keine Verbindung zum Server – nochmal versuchen?', 'error');
  } finally {
    saving = false;
    updateSavebar();
    schedulePreview();
  }
}
$('[data-save]').addEventListener('click', save);
$('[data-discard]').addEventListener('click', () => {
  state = clone(saved);
  syncInputs();
  checkSlug();
  updateSavebar();
  schedulePreview();
  toast('Änderungen verworfen.');
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    save();
  }
});
window.addEventListener('beforeunload', (e) => {
  if (isDirty()) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ------------------------------------------------------------------ Link kopieren
$('[data-copy-link]').addEventListener('click', async () => {
  const url = `${data.publicUrl}/${saved.slug}`;
  try {
    await navigator.clipboard.writeText(url);
    toast('Link kopiert! Jetzt in Discord: Einstellungen → Profile → Über mich → einfügen.');
  } catch {
    window.prompt('Kopier deinen Link:', url);
  }
});

// ------------------------------------------------------------------ Discord neu laden / Löschen
$('[data-refresh-discord]').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    const res = await fetch('/api/me/refresh', { method: 'POST', headers: { Accept: 'application/json' } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error);
    discord = body.discord ?? discord;
    presence = body.presence ?? presence;
    syncDerived();
    schedulePreview();
    toast('Discord-Daten aktualisiert ✓');
  } catch (err) {
    toast(err.message || 'Hat nicht geklappt.', 'error');
  } finally {
    btn.disabled = false;
  }
});
$('[data-delete-profile]').addEventListener('click', async () => {
  if (!window.confirm('Willst du dein Profil wirklich endgültig löschen? Bilder und Link sind dann weg.')) return;
  const res = await fetch('/api/me', { method: 'DELETE', headers: { Accept: 'application/json' } });
  if (res.ok) {
    saved = state;
    window.location.href = '/';
  } else {
    toast('Löschen hat nicht geklappt.', 'error');
  }
});

// ------------------------------------------------------------------ Tabs, Mobil-Ansicht, Gerät
function switchTab(name) {
  for (const btn of $$('[data-tab]')) btn.setAttribute('aria-selected', String(btn.dataset.tab === name));
  for (const panel of $$('[data-panel]')) panel.hidden = panel.dataset.panel !== name;
  $('.ed-sections').scrollTop = 0;
  if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
}
for (const btn of $$('[data-tab]')) btn.addEventListener('click', () => switchTab(btn.dataset.tab));

for (const btn of $$('[data-mview]')) {
  btn.addEventListener('click', () => {
    $('.ed-main').dataset.mviewCurrent = btn.dataset.mview;
    for (const b of $$('[data-mview]')) b.setAttribute('aria-pressed', String(b === btn));
  });
}
for (const btn of $$('[data-device]')) {
  btn.addEventListener('click', () => {
    $('.ed-frame-wrap').dataset.deviceCurrent = btn.dataset.device;
    for (const b of $$('[data-device]')) b.setAttribute('aria-pressed', String(b === btn));
  });
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ------------------------------------------------------------------ Start
const startTab = location.hash.slice(1);
switchTab($$('[data-tab]').some((b) => b.dataset.tab === startTab) ? startTab : 'profil');
syncInputs();
checkSlug();
updateSavebar();
schedulePreview();
