// Gemeinsame Test-Helfer (wird nicht selbst als Test ausgeführt).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';
import { createApp } from '../src/web/server.js';
import { defaultProfile } from '../src/shared/profile.js';

export const silentLog = { debug() {}, info() {}, warn() {}, error() {} };

export function tempDir(prefix = 'deich-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function makeStore() {
  const dir = tempDir();
  return { store: new Store(dir, { log: silentLog }), dir };
}

export function snapshot(id, extra = {}) {
  return {
    id,
    username: `user${id.slice(-2)}`,
    globalName: null,
    displayName: `User ${id.slice(-2)}`,
    avatar: `https://cdn.discordapp.com/avatars/${id}/abc.png`,
    decoration: null,
    banner: null,
    roles: [{ id: 'r1', name: 'Mitglied', color: '#22cc88', color2: null, icon: null, emoji: null }],
    joinedAt: '2024-03-02T10:00:00.000Z',
    createdAt: '2019-05-01T10:00:00.000Z',
    boostingSince: null,
    guildTag: null,
    inGuild: true,
    syncedAt: Date.now(),
    ...extra,
  };
}

export function fakeDiscord() {
  const members = new Map();
  const presences = new Map();
  return {
    members,
    presences,
    ready: true,
    guild: () => ({ id: '1', name: 'Testserver', iconUrl: '', memberCount: 42 }),
    async fetchMember(id) {
      const m = members.get(id);
      return m ? { ...m, inGuild: true, syncedAt: Date.now() } : { id, inGuild: false, syncedAt: Date.now() };
    },
    presence: (id) => presences.get(id) ?? null,
  };
}

/** Legt ein Profil + Discord-Daten an. */
export function seedProfile(store, discord, id, slug, overrides = {}) {
  const profile = { ...defaultProfile({ userId: id, slug }), ...overrides };
  store.putProfile(profile);
  const snap = snapshot(id);
  store.putDiscord(id, snap);
  discord?.members.set(id, snap);
  return profile;
}

/** Startet die Website auf einem freien Port. */
export async function startServer({ store, discord, config: extra = {} }) {
  const config = {
    demo: false,
    publicUrl: '',
    origin: '',
    secureCookies: false,
    trustProxy: false,
    siteName: '',
    allowIndexing: false,
    maxUploadMb: 1,
    loginLinkMinutes: 15,
    sessionDays: 14,
    ...extra,
  };
  const { app } = createApp({ config, store, discord, log: silentLog });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  config.publicUrl = `http://127.0.0.1:${port}`;
  config.origin = config.publicUrl;
  const base = config.publicUrl;

  async function request(pathname, { method = 'GET', cookie, origin = base, headers = {}, body, json } = {}) {
    const h = { ...headers };
    if (cookie) h.Cookie = cookie;
    if (origin && method !== 'GET') h.Origin = origin;
    if (json !== undefined) {
      h['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    }
    const res = await fetch(base + pathname, { method, headers: h, body, redirect: 'manual' });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* kein JSON */
    }
    return { status: res.status, headers: res.headers, text, json: data };
  }

  /** Kompletter Login wie im echten Leben: Token → Bestätigungsseite → POST → Cookie. */
  async function login(userId) {
    const token = store.createLoginToken(userId, 60_000);
    const res = await request('/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `token=${encodeURIComponent(token)}` });
    const setCookie = res.headers.get('set-cookie') ?? '';
    const sid = setCookie.match(/sid=([^;]+)/)?.[1];
    if (!sid) throw new Error(`Login fehlgeschlagen (${res.status})`);
    return `sid=${sid}`;
  }

  return {
    config,
    base,
    request,
    login,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
