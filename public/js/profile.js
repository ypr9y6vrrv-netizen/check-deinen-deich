// Laufzeit der Profilseite: Effekte, 3D-Neigung, Schreibmaschine, Song-Einbettung & Live-Status.
import { startEffect } from './fx.js';

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** 3D-Neigung der Karte mit der Maus. Gibt Aufräum-Funktion zurück. */
export function initTilt(root) {
  const card = root.querySelector('.pf-card');
  if (!card || root.dataset.tilt !== '1' || reducedMotion() || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
    return () => {};
  }
  const MAX = 7;
  let raf = 0;
  const onMove = (e) => {
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      card.classList.add('is-tilting');
      card.style.transform = `rotateX(${((0.5 - py) * MAX).toFixed(2)}deg) rotateY(${((px - 0.5) * MAX).toFixed(2)}deg)`;
      card.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
      card.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
    });
  };
  const onLeave = () => {
    cancelAnimationFrame(raf);
    card.classList.remove('is-tilting');
    card.style.transform = '';
  };
  card.addEventListener('pointermove', onMove);
  card.addEventListener('pointerleave', onLeave);
  return () => {
    card.removeEventListener('pointermove', onMove);
    card.removeEventListener('pointerleave', onLeave);
    cancelAnimationFrame(raf);
  };
}

/** Tippt den Text eines Elements Zeichen für Zeichen. */
export function runTypewriter(el) {
  if (!el || reducedMotion()) return () => {};
  const chars = Array.from(el.textContent);
  let i = 0;
  let timer = 0;
  el.textContent = '';
  el.classList.add('is-typing');
  const tick = () => {
    el.textContent = chars.slice(0, ++i).join('');
    if (i < chars.length) timer = setTimeout(tick, 38 + Math.random() * 60);
  };
  timer = setTimeout(tick, 450);
  return () => {
    clearTimeout(timer);
    el.textContent = chars.join('');
  };
}

/** Song-Player erst nach Klick laden (Datenschutz: vorher keine Verbindung zu Spotify/YouTube). */
export function initSongs(root) {
  for (const box of root.querySelectorAll('.pf-song[data-embed]')) {
    const btn = box.querySelector('.pf-song-btn');
    if (!btn || btn.dataset.bound) continue;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const frame = document.createElement('iframe');
      const provider = box.dataset.provider;
      let src = box.dataset.embed;
      if (provider === 'youtube') {
        src += '?autoplay=1&rel=0';
        frame.className = 'is-video';
      } else {
        frame.height = box.dataset.height || '152';
      }
      frame.src = src;
      frame.title = 'Lieblingssong';
      frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      frame.loading = 'lazy';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      box.replaceChildren(frame);
    });
  }
}

/** Kaputte Avatare (z. B. nach Avatar-Wechsel) durch Initialen ersetzen. */
export function initImageFallbacks(root) {
  const img = root.querySelector('img.pf-avatar-img');
  if (!img) return;
  const fallback = () => {
    const span = document.createElement('span');
    span.className = 'pf-avatar-img pf-avatar-fallback';
    span.textContent = Array.from(root.querySelector('.pf-name')?.textContent.trim() ?? '?')[0]?.toUpperCase() ?? '?';
    img.replaceWith(span);
  };
  if (img.complete && img.naturalWidth === 0) fallback();
  else img.addEventListener('error', fallback, { once: true });
}

/** Fragt alle 30 s den Online-Status ab (nur echte Profilseite). */
function initLive(root) {
  if (root.dataset.live !== '1' || !root.dataset.user) return () => {};
  let timer = 0;
  const poll = async () => {
    if (document.hidden) return;
    try {
      const res = await fetch(`/api/live/${encodeURIComponent(root.dataset.user)}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) return;
      const data = await res.json();
      const dot = root.querySelector('[data-status]');
      if (dot && data.status) {
        dot.className = `pf-status pf-status--${data.status}`;
        dot.title = { online: 'Online', idle: 'Abwesend', dnd: 'Bitte nicht stören', offline: 'Offline' }[data.status] ?? '';
      }
      const live = root.querySelector('.pf-live');
      if (live && typeof data.activityHtml === 'string') live.innerHTML = data.activityHtml;
    } catch {
      /* offline – egal */
    }
  };
  timer = setInterval(poll, 30_000);
  const onVisible = () => !document.hidden && poll();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export function initProfile(root) {
  const stopFx = startEffect(root.querySelector('.pf-fx'), root.dataset.effect, root.dataset.accent);
  const stopTilt = initTilt(root);
  const stopType = root.dataset.typewriter === '1' ? runTypewriter(root.querySelector('.pf-tagline [data-type]')) : () => {};
  const stopLive = initLive(root);
  initSongs(root);
  initImageFallbacks(root);
  return () => {
    stopFx();
    stopTilt();
    stopType();
    stopLive();
  };
}

if (document.body.classList.contains('page-profile') && !document.body.classList.contains('page-preview')) {
  const root = document.querySelector('.pf');
  if (root) initProfile(root);
}
