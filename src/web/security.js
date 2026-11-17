// Sicherheits-Header, CSRF-Schutz, Cookies & Rate-Limits.
import { IMAGE_HOSTS } from '../shared/render.js';

export const EMBED_ORIGINS = ['https://open.spotify.com', 'https://www.youtube-nocookie.com', 'https://w.soundcloud.com'];

export function securityHeaders(config) {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${IMAGE_HOSTS.map((h) => `https://${h}`).join(' ')}`,
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self'",
    `frame-src 'self' ${EMBED_ORIGINS.join(' ')}`,
    "frame-ancestors 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');

  return (req, res, next) => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
    if (!config.allowIndexing) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  };
}

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    if (!key || Object.hasOwn(out, key)) continue;
    const value = part.slice(i + 1).trim();
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

/** true, wenn die Anfrage von unserer eigenen Seite kommt (Schutz gegen CSRF). */
export function isSameOrigin(req, config) {
  const fetchSite = req.get('sec-fetch-site');
  if (fetchSite) return fetchSite === 'same-origin';
  const origin = req.get('origin');
  if (origin) return origin === config.origin || origin === `${req.protocol}://${req.get('host')}`;
  const referer = req.get('referer');
  if (referer) {
    try {
      const o = new URL(referer).origin;
      return o === config.origin || o === `${req.protocol}://${req.get('host')}`;
    } catch {
      return false;
    }
  }
  return false;
}

export function requireSameOrigin(config) {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    if (isSameOrigin(req, config)) return next();
    res.status(403);
    if (req.accepts(['json', 'html']) === 'json' || req.path.startsWith('/api')) {
      return res.json({ error: 'Anfrage blockiert (fremde Herkunft).' });
    }
    return res.type('text/plain').send('Anfrage blockiert (fremde Herkunft).');
  };
}

/** Einfaches In-Memory-Rate-Limit (feste Zeitfenster). */
export function rateLimit({ windowMs, max, key = (req) => req.ip, message = 'Zu viele Anfragen – warte kurz.' }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, Math.max(windowMs, 30_000));
  timer.unref?.();

  return (req, res, next) => {
    const k = key(req) ?? 'anon';
    const now = Date.now();
    let h = hits.get(k);
    if (!h || h.reset <= now) {
      h = { count: 0, reset: now + windowMs };
      hits.set(k, h);
    }
    h.count++;
    if (h.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      res.status(429);
      if (req.path.startsWith('/api') || req.baseUrl.startsWith('/api')) return res.json({ error: message });
      return res.type('text/plain').send(message);
    }
    next();
  };
}
