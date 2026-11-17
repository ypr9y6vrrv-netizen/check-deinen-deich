// Der Discord-Bot: Verbindung, Befehls-Registrierung und Zugriff auf Mitgliederdaten für die Website.
import { ActivityType, Client, Events, GatewayIntentBits, OAuth2Scopes, PermissionFlagsBits, RESTJSONErrorCodes } from 'discord.js';
import { buildSnapshot, buildPresence } from './snapshot.js';
import { commandDefinitions, createInteractionHandler } from './commands.js';

const guildInfo = (g) => ({ id: g.id, name: g.name, iconUrl: g.iconURL({ size: 256 }) ?? '', memberCount: g.memberCount ?? null });

/**
 * Erstellt den Client und das "Adapter"-Objekt, über das die Website Discord-Daten bekommt.
 * Der Login passiert erst mit `start()`.
 */
export function createBot({ config, store, log }) {
  const intents = [GatewayIntentBits.Guilds];
  if (config.presenceIntent) intents.push(GatewayIntentBits.GuildPresences);
  const client = new Client({ intents, allowedMentions: { parse: [] } });

  const getGuild = async () => client.guilds.cache.get(config.guildId) ?? client.guilds.fetch(config.guildId);

  const adapter = {
    get ready() {
      return client.isReady();
    },
    guild() {
      const g = client.guilds.cache.get(config.guildId);
      return g ? guildInfo(g) : null;
    },
    async fetchMember(userId) {
      if (!client.isReady()) throw new Error('Bot ist (noch) nicht verbunden');
      const guild = await getGuild();
      try {
        const member = await guild.members.fetch({ user: userId, force: true });
        await client.users.fetch(userId, { force: true }).catch(() => null); // Banner & Akzentfarbe
        return buildSnapshot(member);
      } catch (err) {
        if (err.code === RESTJSONErrorCodes.UnknownMember || err.code === RESTJSONErrorCodes.UnknownUser) {
          const prev = store.getDiscord(userId);
          return { ...(prev ?? { id: userId }), inGuild: false, syncedAt: Date.now() };
        }
        throw err;
      }
    },
    presence(userId) {
      if (!config.presenceIntent || !client.isReady()) return null;
      const p = client.guilds.cache.get(config.guildId)?.presences.cache.get(userId);
      return p ? buildPresence(p) : { status: 'offline', custom: null, activity: null };
    },
  };

  let handlersRegistered = false;
  function registerHandlers({ snapshots, site }) {
    if (handlersRegistered) return;
    handlersRegistered = true;
    const handleInteraction = createInteractionHandler({ config, store, snapshots, site, log });
    client.on(Events.InteractionCreate, handleInteraction);

    client.once(Events.ClientReady, async (c) => {
      log.info(`🤖 Bot eingeloggt als ${c.user.tag}`);
      c.user.setPresence({ activities: [{ type: ActivityType.Custom, name: 'custom', state: '✏️ /profil bearbeiten' }] });
      let guild;
      try {
        guild = await getGuild();
      } catch {
        const invite = c.generateInvite({
          scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
          permissions: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
        });
        log.error(`❌ Der Bot ist nicht auf dem Server mit GUILD_ID=${config.guildId}. Lade ihn hiermit ein:\n   ${invite}`);
        return;
      }
      store.setMeta('guild', guildInfo(guild));
      try {
        await guild.commands.set(commandDefinitions());
        log.info(`✅ Befehle auf „${guild.name}“ registriert: /profil, /profil-admin, Rechtsklick → Apps → Profil anzeigen`);
      } catch (err) {
        log.error(`❌ Befehle konnten nicht registriert werden (${err.message}). Wurde der Bot mit dem Scope "applications.commands" eingeladen?`);
      }
    });

    client.on(Events.GuildUpdate, (_old, g) => {
      if (g.id === config.guildId) store.setMeta('guild', guildInfo(g));
    });
    client.on(Events.Error, (err) => log.error('Discord-Fehler:', err));
    client.on(Events.ShardReconnecting, () => log.warn('⚠️  Verbindung zu Discord unterbrochen – verbinde neu …'));
    client.on(Events.ShardDisconnect, (event) => log.error(`❌ Discord hat die Verbindung beendet (Code ${event?.code}). Bitte den Bot neu starten.`));
  }

  /** Registriert die Event-Handler (einmalig) und loggt den Bot ein. Darf nach Netzwerkfehlern erneut aufgerufen werden. */
  async function start({ snapshots, site }) {
    registerHandlers({ snapshots, site });
    try {
      await client.login(config.discordToken);
    } catch (err) {
      if (/disallowed intents/i.test(err.message)) {
        throw new Error('Discord lehnt den "Presence Intent" ab. Aktiviere ihn im Developer Portal (Bot → Privileged Gateway Intents) oder setz DISCORD_PRESENCE_INTENT=false.');
      }
      if (/token/i.test(err.message) || err.code === 'TokenInvalid') {
        throw new Error('Der DISCORD_TOKEN ist ungültig. Hol dir im Developer Portal unter "Bot" einen neuen (Reset Token).');
      }
      throw err;
    }
  }

  /** Hält Avatare/Rollen aller Profile im Hintergrund aktuell (schonend, eins nach dem anderen). */
  function startPeriodicSync({ snapshots, everyMs = 30 * 60 * 1000, staleMs = 25 * 60 * 1000 }) {
    let running = false;
    const tick = async () => {
      if (running || !client.isReady()) return;
      running = true;
      try {
        for (const p of store.listProfiles()) {
          const snap = store.getDiscord(p.userId);
          if (snap && Date.now() - (snap.syncedAt ?? 0) < staleMs) continue;
          await snapshots.refresh(p.userId);
          await new Promise((r) => setTimeout(r, 1500));
        }
      } finally {
        running = false;
      }
    };
    const timer = setInterval(tick, everyMs);
    timer.unref?.();
    return () => clearInterval(timer);
  }

  return { client, adapter, start, startPeriodicSync, destroy: () => client.destroy() };
}
