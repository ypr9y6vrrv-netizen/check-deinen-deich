// Liest die Konfiguration aus Umgebungsvariablen bzw. der .env-Datei.
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');

const bool = (v, fallback = false) => (v === undefined || v === '' ? fallback : /^(1|true|ja|yes|on)$/i.test(String(v).trim()));
const int = (v, fallback) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

export class ConfigError extends Error {}

/**
 * @param {object} [o]
 * @param {string[]} [o.argv]
 * @param {Record<string,string|undefined>} [o.env]
 * @param {boolean} [o.loadDotEnv]
 */
export function loadConfig({ argv = process.argv.slice(2), env = process.env, loadDotEnv = true } = {}) {
  const envFile = path.join(ROOT, '.env');
  if (loadDotEnv && fs.existsSync(envFile)) process.loadEnvFile(envFile);

  const demo = argv.includes('--demo') || bool(env.DEMO_MODE);
  const port = int(env.PORT, 3000);
  let publicUrl = (env.PUBLIC_URL || `http://localhost:${port}`).trim().replace(/\/+$/, '');
  let origin;
  try {
    const u = new URL(publicUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error();
    origin = u.origin;
    publicUrl = u.origin + u.pathname.replace(/\/+$/, '');
  } catch {
    throw new ConfigError(`PUBLIC_URL ist keine gültige URL: "${publicUrl}" (Beispiel: https://profile.example.de)`);
  }
  if (publicUrl !== origin) {
    throw new ConfigError('PUBLIC_URL darf keinen Unterpfad haben – die Seite muss direkt unter einer (Sub-)Domain laufen.');
  }

  const config = {
    demo,
    discordToken: (env.DISCORD_TOKEN ?? '').trim(),
    guildId: (env.GUILD_ID ?? '').trim(),
    presenceIntent: bool(env.DISCORD_PRESENCE_INTENT),
    port,
    host: env.HOST || '0.0.0.0',
    publicUrl,
    origin,
    secureCookies: publicUrl.startsWith('https://'),
    trustProxy: parseTrustProxy(env.TRUST_PROXY),
    dataDir: path.resolve(ROOT, env.DATA_DIR || (demo ? 'data-demo' : 'data')),
    siteName: (env.SITE_NAME ?? '').trim(),
    allowIndexing: bool(env.ALLOW_INDEXING),
    maxUploadMb: Math.min(25, Math.max(1, int(env.MAX_UPLOAD_MB, 8))),
    loginLinkMinutes: Math.min(60, Math.max(3, int(env.LOGIN_LINK_MINUTES, 15))),
    sessionDays: Math.min(90, Math.max(1, int(env.SESSION_DAYS, 14))),
    logLevel: env.LOG_LEVEL || 'info',
  };

  if (!demo) {
    const missing = [];
    if (!config.discordToken) missing.push('DISCORD_TOKEN');
    if (!/^\d{15,22}$/.test(config.guildId)) missing.push('GUILD_ID');
    if (missing.length) {
      throw new ConfigError(
        `Es fehlt: ${missing.join(', ')}.\n` +
          '  → Kopiere .env.example nach .env und trag die Werte ein (Anleitung in der README).\n' +
          '  → Oder starte erstmal nur die Website zum Ausprobieren: npm run demo',
      );
    }
  }
  return config;
}

function parseTrustProxy(v) {
  if (v === undefined || v === '') return false;
  if (/^(true|ja|yes|on)$/i.test(v)) return true;
  if (/^(false|nein|no|off)$/i.test(v)) return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v; // z. B. "loopback" oder IP-Liste
}
