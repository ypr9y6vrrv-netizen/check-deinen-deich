import test from 'node:test';
import assert from 'node:assert/strict';
import { ActivityType, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { commandDefinitions, createInteractionHandler, CONTEXT_MENU_NAME, isDiscordLinkable } from '../src/bot/commands.js';
import { buildSnapshot, buildPresence } from '../src/bot/snapshot.js';
import { createSnapshotService } from '../src/web/server.js';
import { makeStore, fakeDiscord, snapshot, silentLog } from './helpers.js';

const GUILD = '900000000000000000';
const ME = '100000000000000001';
const OTHER = '100000000000000002';

function setup() {
  const { store } = makeStore();
  const discord = fakeDiscord();
  discord.members.set(ME, snapshot(ME, { username: 'luna.exe' }));
  discord.members.set(OTHER, snapshot(OTHER, { username: 'kai' }));
  const config = { guildId: GUILD, publicUrl: 'https://profile.example.de', loginLinkMinutes: 15 };
  const snapshots = createSnapshotService({ store, discord, log: silentLog });
  const handle = createInteractionHandler({ config, store, snapshots, site: () => ({ name: 'Testserver' }), log: silentLog });
  return { store, discord, handle };
}

/** Minimaler Nachbau einer discord.js-Interaktion. */
function fakeInteraction({ kind = 'chat', command = 'profil', sub, options = {}, userId = ME, guildId = GUILD, perms = 0n, customId, target } = {}) {
  const calls = [];
  const user = { id: userId, username: userId === ME ? 'luna.exe' : 'kai', displayName: 'User', bot: false };
  const i = {
    calls,
    guildId,
    user,
    commandName: command,
    customId,
    targetUser: target,
    deferred: false,
    replied: false,
    channel: options.channel ?? null,
    memberPermissions: { has: (p) => (perms & p) === p },
    inGuild: () => true,
    isRepliable: () => true,
    isChatInputCommand: () => kind === 'chat',
    isUserContextMenuCommand: () => kind === 'user',
    isButton: () => kind === 'button',
    options: {
      getSubcommand: () => sub,
      getUser: (name, required) => {
        if (options[name]) return options[name];
        if (required) throw new Error('required');
        return null;
      },
      getChannel: (name) => options[name] ?? null,
    },
    async deferReply(payload) {
      calls.push(['deferReply', payload]);
      i.deferred = true;
    },
    async reply(payload) {
      calls.push(['reply', payload]);
      i.replied = true;
    },
    async editReply(payload) {
      calls.push(['editReply', payload]);
    },
  };
  return i;
}

const lastPayload = (i) => i.calls.at(-1)[1];
const embedJson = (payload) => payload.embeds?.[0]?.toJSON?.() ?? payload.embeds?.[0];
const buttonUrls = (payload) => payload.components.flatMap((row) => row.components.map((c) => c.data.url ?? c.data.custom_id));

test('Befehls-Definitionen sind gültig', () => {
  const defs = commandDefinitions();
  const names = defs.map((d) => d.name);
  assert.deepEqual(names, ['profil', 'profil-admin', CONTEXT_MENU_NAME]);
  assert.deepEqual(defs[0].options.map((o) => o.name), ['bearbeiten', 'link', 'anzeigen']);
  assert.deepEqual(defs[1].options.map((o) => o.name), ['panel', 'ausblenden', 'einblenden', 'entfernen']);
  assert.equal(defs[1].default_member_permissions, String(PermissionFlagsBits.ManageGuild));
});

test('/profil bearbeiten legt Profil an und schickt privaten Login-Link', async () => {
  const { store, handle } = setup();
  const i = fakeInteraction({ sub: 'bearbeiten' });
  await handle(i);
  assert.deepEqual(i.calls[0], ['deferReply', { flags: MessageFlags.Ephemeral }]);
  const profile = store.getProfile(ME);
  assert.equal(profile.slug, 'luna.exe');
  const payload = lastPayload(i);
  assert.match(embedJson(payload).title, /angelegt/);
  const [loginUrl, viewUrl] = buttonUrls(payload);
  assert.match(loginUrl, /^https:\/\/profile\.example\.de\/login\?token=[\w-]{40,}$/);
  assert.equal(viewUrl, 'https://profile.example.de/luna.exe');
  const token = decodeURIComponent(new URL(loginUrl).searchParams.get('token'));
  assert.equal(store.peekLoginToken(token).userId, ME);

  const again = fakeInteraction({ sub: 'bearbeiten' });
  await handle(again);
  assert.match(embedJson(lastPayload(again)).title, /Editor/);
  assert.equal(store.listProfiles().length, 1);
});

test('Slug-Kollision bekommt eine Nummer', async () => {
  const { store, discord, handle } = setup();
  discord.members.set(OTHER, snapshot(OTHER, { username: 'luna.exe' }));
  await handle(fakeInteraction({ sub: 'bearbeiten' }));
  await handle(fakeInteraction({ sub: 'bearbeiten', userId: OTHER }));
  assert.equal(store.getProfile(OTHER).slug, 'luna.exe-2');
});

test('/profil link zeigt die Bio-Anleitung', async () => {
  const { handle } = setup();
  const i = fakeInteraction({ sub: 'link' });
  await handle(i);
  const embed = embedJson(lastPayload(i));
  assert.match(embed.description, /https:\/\/profile\.example\.de\/luna\.exe/);
  assert.match(embed.description, /Über mich/);
});

test('/profil anzeigen & Rechtsklick-Menü', async () => {
  const { store, handle } = setup();
  const none = fakeInteraction({ sub: 'anzeigen', options: { mitglied: { id: OTHER, username: 'kai', displayName: 'Kai', bot: false } } });
  await handle(none);
  assert.equal(none.calls[0][0], 'reply');
  assert.match(none.calls[0][1].content, /noch kein öffentliches Profil/);
  assert.equal(none.calls[0][1].flags, MessageFlags.Ephemeral);

  await handle(fakeInteraction({ sub: 'bearbeiten', userId: OTHER }));
  const p = store.getProfile(OTHER);
  store.putProfile({ ...p, tagline: 'CS2 *Grinder*', pronouns: 'er/ihm', links: [{ url: 'https://www.twitch.tv/kai', label: 'Live [jetzt]' }], tags: ['CS2'] });

  const shown = fakeInteraction({ sub: 'anzeigen', options: { mitglied: { id: OTHER, username: 'kai', displayName: 'Kai', bot: false } } });
  await handle(shown);
  assert.deepEqual(shown.calls[0], ['deferReply', {}], 'öffentliche Antwort im Chat');
  const embed = embedJson(lastPayload(shown));
  assert.equal(embed.url, 'https://profile.example.de/kai');
  assert.ok(embed.fields.find((f) => f.name === 'Pronomen' && f.value === 'er/ihm'));
  assert.ok(embed.fields.find((f) => f.name === 'Links' && f.value.includes('[Live \\[jetzt\\]](https://www.twitch.tv/kai)')));

  const ctx = fakeInteraction({ kind: 'user', command: CONTEXT_MENU_NAME, target: { id: OTHER, username: 'kai', bot: false } });
  await handle(ctx);
  assert.deepEqual(ctx.calls[0], ['deferReply', { flags: MessageFlags.Ephemeral }], 'Rechtsklick antwortet privat');

  const bot = fakeInteraction({ sub: 'anzeigen', options: { mitglied: { id: '5', username: 'botty', bot: true } } });
  await handle(bot);
  assert.match(bot.calls[0][1].content, /Bots/);
});

test('Panel-Buttons funktionieren wie die Befehle', async () => {
  const { store, handle } = setup();
  const i = fakeInteraction({ kind: 'button', customId: 'profil:edit' });
  await handle(i);
  assert.ok(store.getProfile(ME));
  assert.match(buttonUrls(lastPayload(i))[0], /\/login\?token=/);
});

test('/profil-admin: Rechte, Panel, Ausblenden bleibt auch nach Löschen', async () => {
  const { store, handle } = setup();
  await handle(fakeInteraction({ sub: 'bearbeiten', userId: OTHER }));
  const target = { id: OTHER, username: 'kai', bot: false };

  const denied = fakeInteraction({ command: 'profil-admin', sub: 'ausblenden', options: { mitglied: target } });
  await handle(denied);
  assert.match(denied.calls[0][1].content, /Server verwalten/);
  assert.equal(store.getProfile(OTHER).hidden, false);

  const sent = [];
  const channel = { isTextBased: () => true, send: async (p) => sent.push(p), toString: () => '#profile' };
  const panel = fakeInteraction({ command: 'profil-admin', sub: 'panel', perms: PermissionFlagsBits.ManageGuild, options: { channel } });
  await handle(panel);
  assert.equal(sent.length, 1);
  assert.deepEqual(buttonUrls(sent[0]), ['profil:edit', 'profil:link', 'https://profile.example.de']);

  const hide = fakeInteraction({ command: 'profil-admin', sub: 'ausblenden', perms: PermissionFlagsBits.ManageGuild, options: { mitglied: target } });
  await handle(hide);
  assert.equal(store.getProfile(OTHER).hidden, true);

  // Nutzer löscht sein Profil und legt ein neues an → bleibt gesperrt
  store.deleteProfile(OTHER);
  await handle(fakeInteraction({ sub: 'bearbeiten', userId: OTHER }));
  assert.equal(store.getProfile(OTHER).hidden, true);

  const unhide = fakeInteraction({ command: 'profil-admin', sub: 'einblenden', perms: PermissionFlagsBits.ManageGuild, options: { mitglied: target } });
  await handle(unhide);
  assert.equal(store.getProfile(OTHER).hidden, false);

  const remove = fakeInteraction({ command: 'profil-admin', sub: 'entfernen', perms: PermissionFlagsBits.ManageGuild, options: { mitglied: target } });
  await handle(remove);
  assert.equal(store.getProfile(OTHER), null);
});

test('Fremde Server werden abgewiesen, Fehler sauber beantwortet', async () => {
  const { handle, discord } = setup();
  const foreign = fakeInteraction({ sub: 'bearbeiten', guildId: '123' });
  await handle(foreign);
  assert.match(foreign.calls[0][1].content, /anderen Server/);

  discord.fetchMember = async () => {
    throw new Error('Discord down');
  };
  const i = fakeInteraction({ sub: 'bearbeiten' });
  i.editReply = async (payload) => {
    i.calls.push(['editReply', payload]);
    if (payload.embeds?.length) throw new Error('kaputt');
  };
  await handle(i);
  assert.match(lastPayload(i).content, /schiefgelaufen/);
});

test('buildSnapshot & buildPresence übersetzen discord.js-Objekte', () => {
  const role = (id, name, position, primaryColor, extra = {}) => ({ id, name, position, managed: false, colors: { primaryColor, secondaryColor: null }, iconURL: () => null, unicodeEmoji: null, ...extra });
  const roles = new Map([
    [GUILD, role(GUILD, '@everyone', 0, 0)],
    ['r1', role('r1', 'Mitglied', 1, 0)],
    ['r2', role('r2', 'Admin', 5, 0xff0000, { colors: { primaryColor: 0xff0000, secondaryColor: 0x00ff00 } })],
    ['r3', role('r3', 'BotRolle', 9, 0x123456, { managed: true })],
  ]);
  const member = {
    guild: { id: GUILD },
    user: {
      id: ME, username: 'luna.exe', globalName: 'Luna', bot: false, createdAt: new Date('2020-01-01T00:00:00Z'),
      hexAccentColor: '#abcdef', primaryGuild: { identityEnabled: true, tag: 'DEICH' }, guildTagBadgeURL: () => 'https://cdn.discordapp.com/badge.png',
    },
    roles: { cache: roles },
    displayName: 'Luna 🌙',
    displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/1/a.webp',
    displayAvatarDecorationURL: () => null,
    displayBannerURL: () => null,
    joinedAt: new Date('2024-01-01T00:00:00Z'),
    premiumSince: null,
  };
  const snap = buildSnapshot(member);
  assert.deepEqual(snap.roles.map((r) => r.name), ['Admin', 'Mitglied']);
  assert.equal(snap.roles[0].color, '#ff0000');
  assert.equal(snap.roles[0].color2, '#00ff00');
  assert.equal(snap.roles[1].color, null);
  assert.deepEqual(snap.guildTag, { tag: 'DEICH', badge: 'https://cdn.discordapp.com/badge.png' });
  assert.equal(snap.joinedAt, '2024-01-01T00:00:00.000Z');
  assert.equal(snap.inGuild, true);

  const presence = buildPresence({
    status: 'online',
    activities: [
      { type: ActivityType.Custom, state: 'chillt', emoji: { id: '77', name: 'pepe', animated: true } },
      { type: ActivityType.Listening, name: 'Spotify', details: 'Song', state: 'Artist', timestamps: { start: new Date(1000) }, assets: { largeImageURL: () => 'https://i.scdn.co/image/x' } },
    ],
  });
  assert.equal(presence.status, 'online');
  assert.deepEqual(presence.custom, { text: 'chillt', emoji: { name: 'pepe', url: 'https://cdn.discordapp.com/emojis/77.gif?size=48' } });
  assert.deepEqual(presence.activity, { type: 'listening', name: 'Spotify', details: 'Song', state: 'Artist', image: 'https://i.scdn.co/image/x', startedAt: 1000 });
  assert.equal(buildPresence(null), null);
});

test('Bei localhost-Adresse schickt der Bot Links als Text statt Buttons', async () => {
  const { store } = makeStore();
  const discord = fakeDiscord();
  discord.members.set(ME, snapshot(ME, { username: 'luna.exe' }));
  const warnings = [];
  const log = { ...silentLog, warn: (m) => warnings.push(m) };
  const snapshots = createSnapshotService({ store, discord, log });
  const handle = createInteractionHandler({ config: { guildId: GUILD, publicUrl: 'http://localhost:3000', loginLinkMinutes: 15 }, store, snapshots, site: () => ({ name: 'T' }), log });
  assert.equal(warnings.length, 1);

  const i = fakeInteraction({ sub: 'bearbeiten' });
  await handle(i);
  const payload = lastPayload(i);
  assert.deepEqual(payload.components, []);
  assert.match(payload.content, /Profil bearbeiten:\*\* http:\/\/localhost:3000\/login\?token=/);

  const show = fakeInteraction({ sub: 'anzeigen' });
  await handle(show);
  assert.equal(embedJson(lastPayload(show)).url, undefined);
});

test('isDiscordLinkable', () => {
  assert.equal(isDiscordLinkable('https://profile.example.de'), true);
  assert.equal(isDiscordLinkable('http://deich.duckdns.org:3000'), true);
  assert.equal(isDiscordLinkable('http://localhost:3000'), false);
  assert.equal(isDiscordLinkable('http://192.168.0.10:3000'), false);
  assert.equal(isDiscordLinkable('kaputt'), false);
});
