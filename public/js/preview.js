// Läuft im Vorschau-<iframe> des Editors: rendert das Profil neu, sobald der Editor Daten schickt.
import { renderProfile } from '/shared/render.js';
import { startEffect } from './fx.js';
import { initTilt, runTypewriter, initSongs, initImageFallbacks } from './profile.js';

const root = document.getElementById('preview-root');
const canvas = document.createElement('canvas');
canvas.className = 'pf-fx';
canvas.setAttribute('aria-hidden', 'true');

let fxKey = '';
let stopFx = () => {};
let stopTilt = () => {};
let stopType = () => {};
let typeKey = '';

function render(payload) {
  root.innerHTML = renderProfile({ ...payload, preview: true });
  const pf = root.firstElementChild;
  if (!pf) return;

  // Canvas behalten, damit der Effekt nicht bei jedem Tastendruck neu startet
  pf.querySelector('.pf-fx')?.replaceWith(canvas);
  const key = `${pf.dataset.effect}|${pf.dataset.accent}`;
  if (key !== fxKey) {
    stopFx();
    stopFx = startEffect(canvas, pf.dataset.effect, pf.dataset.accent);
    fxKey = key;
  }

  stopTilt();
  stopTilt = initTilt(pf);

  const tagline = pf.querySelector('.pf-tagline [data-type]');
  const nextTypeKey = pf.dataset.typewriter === '1' && tagline ? tagline.textContent : '';
  if (nextTypeKey && nextTypeKey !== typeKey) {
    stopType();
    stopType = runTypewriter(tagline);
  }
  typeKey = nextTypeKey;

  initSongs(pf);
  initImageFallbacks(pf);
}

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.source !== window.parent) return;
  if (e.data?.type === 'render') {
    try {
      render(e.data.payload);
    } catch (err) {
      console.error('Vorschau-Fehler', err);
    }
  }
});

window.parent.postMessage({ type: 'preview-ready' }, location.origin);
