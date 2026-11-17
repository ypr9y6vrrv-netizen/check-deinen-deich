// Startpunkt: lädt die Konfiguration, startet Website + Discord-Bot.
import { loadConfig, ConfigError } from './config.js';
import { Store } from './store.js';
import { createLogger } from './log.js';
import { createApp, createSnapshotService, collectUploadGarbage } from './web/server.js';

const HOUR = 60 * 60 * 1000;

let config;
try {
  config = loadConfig();
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(`\n❌ ${err.message}\n`);
    process.exit(1);
  }
  throw err;
}

const log = createLogger(config.logLevel);
const store = new Store(config.dataDir, { log });

let discord;
let extraRoutes;
let bot = null;
if (config.demo) {
  const { createDemo } = await import('./demo.js');
  ({ adapter: discord, extraRoutes } = await createDemo({ store, log }));
} else {
  const { createBot } = await import('./bot/bot.js');
  bot = createBot({ config, store, log });
  discord = bot.adapter;
}

const snapshots = createSnapshotService({ store, discord, log });
const { app, site } = createApp({ config, store, discord, log, extraRoutes, snapshots });

const server = app.listen(config.port, config.host, () => {
  log.info(`🌐 Website läuft: ${config.publicUrl}  (lokal auf Port ${config.port})`);
  if (config.demo) log.info(`🧪 Demo-Modus – zum Editor: ${config.publicUrl}/demo`);
});

// Aufräumen: abgelaufene Sitzungen & ungenutzte Bilder
const housekeeping = setInterval(() => {
  store.purgeExpired();
  collectUploadGarbage({ store, log });
}, HOUR);
housekeeping.unref();
store.purgeExpired();

let shuttingDown = false;
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

if (bot) {
  await startBotWithRetry();
}

/** Startet den Bot. Bei Netzwerkproblemen wird es alle 30 s erneut versucht – die Website läuft weiter. */
async function startBotWithRetry() {
  for (;;) {
    try {
      await bot.start({ snapshots, site });
      bot.startPeriodicSync({ snapshots });
      return;
    } catch (err) {
      const network = ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(err.code ?? err.cause?.code);
      if (!network) {
        log.error(`❌ ${err.message}`);
        shutdown(1);
        return;
      }
      log.warn(`⚠️  Keine Verbindung zu Discord (${err.code ?? err.cause?.code}) – neuer Versuch in 30 s. Die Website läuft weiter.`);
      await new Promise((r) => setTimeout(r, 30_000));
      if (shuttingDown) return;
    }
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('👋 Fahre herunter …');
  store.close();
  bot?.destroy();
  server.close(() => process.exit(code));
  setTimeout(() => process.exit(code), 3000).unref();
}
