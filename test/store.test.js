import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Store } from '../src/store.js';
import { defaultProfile } from '../src/shared/profile.js';
import { makeStore, silentLog } from './helpers.js';

test('Profile & Slug-Index', () => {
  const { store } = makeStore();
  store.putProfile(defaultProfile({ userId: '1', slug: 'luna' }));
  assert.equal(store.getProfileBySlug('LUNA').userId, '1');
  assert.equal(store.isSlugTaken('luna'), true);
  assert.equal(store.isSlugTaken('luna', '1'), false);
  assert.throws(() => store.putProfile(defaultProfile({ userId: '2', slug: 'luna' })), /vergeben/);

  const p = store.getProfile('1');
  store.putProfile({ ...p, slug: 'mond' });
  assert.equal(store.getProfileBySlug('luna'), null, 'alter Slug wird frei');
  assert.equal(store.getProfileBySlug('mond').userId, '1');
  store.putProfile(defaultProfile({ userId: '2', slug: 'luna' }));
  assert.equal(store.listProfiles().length, 2);
});

test('Login-Links funktionieren genau einmal und laufen ab', () => {
  const { store } = makeStore();
  const token = store.createLoginToken('1', 60_000);
  assert.equal(store.peekLoginToken(token).userId, '1');
  assert.equal(store.consumeLoginToken(token), '1');
  assert.equal(store.consumeLoginToken(token), null);

  const expired = store.createLoginToken('2', -1);
  assert.equal(store.peekLoginToken(expired), null);
  assert.equal(store.peekLoginToken('kurz'), null);
  assert.equal(store.peekLoginToken({}), null);

  const a = store.createLoginToken('3', 60_000);
  const b = store.createLoginToken('3', 60_000);
  assert.equal(store.peekLoginToken(a), null, 'neuer Link macht den alten ungültig');
  assert.equal(store.peekLoginToken(b).userId, '3');
});

test('Tokens & Sitzungen werden nur gehasht gespeichert', () => {
  const { store } = makeStore();
  const token = store.createLoginToken('1', 60_000);
  const sid = store.createSession('1', 60_000);
  store.flush();
  const raw = fs.readFileSync(store.file, 'utf8');
  assert.equal(raw.includes(token), false);
  assert.equal(raw.includes(sid), false);
});

test('Sitzungen: anlegen, ablaufen, löschen', () => {
  const { store } = makeStore();
  const sid = store.createSession('1', 60_000);
  assert.equal(store.getSession(sid).userId, '1');
  store.deleteSession(sid);
  assert.equal(store.getSession(sid), null);

  const old = store.createSession('1', -1);
  assert.equal(store.getSession(old), null);

  const s1 = store.createSession('5', 60_000);
  const s2 = store.createSession('5', 60_000);
  store.deleteSessionsOf('5');
  assert.equal(store.getSession(s1), null);
  assert.equal(store.getSession(s2), null);
});

test('Daten überleben einen Neustart', () => {
  const { store, dir } = makeStore();
  store.putProfile(defaultProfile({ userId: '9', slug: 'neun' }));
  store.putDiscord('9', { username: 'neun' });
  store.addView('9');
  const sid = store.createSession('9', 60_000);
  store.close();

  const again = new Store(dir, { log: silentLog });
  assert.equal(again.getProfileBySlug('neun').views, 1);
  assert.equal(again.getDiscord('9').username, 'neun');
  assert.equal(again.getSession(sid).userId, '9');
  assert.equal(fs.readdirSync(dir).some((f) => f.endsWith('.tmp')), false, 'keine Temp-Dateien übrig');
});

test('Beschädigte Datenbank wird nicht stillschweigend überschrieben', () => {
  const { store, dir } = makeStore();
  store.close();
  fs.writeFileSync(path.join(dir, 'db.json'), '{kaputt');
  assert.throws(() => new Store(dir, { log: silentLog }), /beschädigt/);
});

test('deleteProfile räumt alles des Nutzers weg', () => {
  const { store } = makeStore();
  store.putProfile(defaultProfile({ userId: '1', slug: 'eins' }));
  store.putDiscord('1', { username: 'x' });
  store.addUpload('a.webp', { owner: '1', createdAt: Date.now() });
  store.addUpload('b.webp', { owner: '2', createdAt: Date.now() });
  const sid = store.createSession('1', 60_000);
  const token = store.createLoginToken('1', 60_000);

  assert.deepEqual(store.deleteProfile('1'), ['a.webp']);
  assert.equal(store.getProfile('1'), null);
  assert.equal(store.getProfileBySlug('eins'), null);
  assert.equal(store.getDiscord('1'), null);
  assert.equal(store.getSession(sid), null);
  assert.equal(store.peekLoginToken(token), null);
  assert.equal(store.getUpload('a.webp'), null);
  assert.ok(store.getUpload('b.webp'));
});

test('purgeExpired entfernt abgelaufene Einträge', () => {
  const { store } = makeStore();
  store.createSession('1', -10);
  store.createLoginToken('2', -10);
  store.createSession('3', 60_000);
  assert.equal(store.purgeExpired(), 2);
  assert.equal(Object.keys(store.data.sessions).length, 1);
});
