import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { collectUploadGarbage } from '../src/web/server.js';
import { makeStore, fakeDiscord, seedProfile, startServer, silentLog } from './helpers.js';

const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130 Safari/537.36';

async function setup() {
  const { store, dir } = makeStore();
  const discord = fakeDiscord();
  const luna = seedProfile(store, discord, '100000000000000001', 'luna', { tagline: 'Nachteule' });
  const kai = seedProfile(store, discord, '100000000000000002', 'kai');
  const srv = await startServer({ store, discord });
  return { store, dir, discord, luna, kai, srv };
}

test('Website: öffentliche Seiten', async (t) => {
  const { store, discord, srv } = await setup();
  t.after(() => srv.close());

  await t.test('Mitgliederliste zeigt öffentliche Profile', async () => {
    const res = await srv.request('/');
    assert.equal(res.status, 200);
    assert.match(res.text, /href="\/luna"/);
    assert.match(res.text, /href="\/kai"/);
    assert.match(res.text, /Testserver/);
  });

  await t.test('Profilseite mit Vorschau-Tags für Discord', async () => {
    const res = await srv.request('/luna');
    assert.equal(res.status, 200);
    assert.match(res.text, /<meta property="og:title" content="User 01 \(@user01\)">/);
    assert.match(res.text, /<meta property="og:description" content="Nachteule">/);
    assert.match(res.text, /<meta name="theme-color" content="#[0-9a-f]{6}">/);
    assert.match(res.text, /og:image" content="https:\/\/cdn\.discordapp\.com/);
  });

  await t.test('Groß-/Kleinschreibung leitet um, /u/<id> auch', async () => {
    assert.equal((await srv.request('/LUNA')).headers.get('location'), '/luna');
    assert.equal((await srv.request('/u/100000000000000001')).headers.get('location'), '/luna');
  });

  await t.test('Sicherheits-Header sind gesetzt', async () => {
    const res = await srv.request('/luna');
    assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.match(res.headers.get('x-robots-tag'), /noindex/);
    assert.equal(res.headers.get('x-powered-by'), null);
  });

  await t.test('private, ausgeblendete & ausgetretene Profile sind 404', async () => {
    const kai = store.getProfile('100000000000000002');
    store.putProfile({ ...kai, published: false });
    assert.equal((await srv.request('/kai')).status, 404);
    assert.doesNotMatch((await srv.request('/')).text, /href="\/kai"/);
    assert.equal((await srv.request('/u/100000000000000002')).status, 404);

    store.putProfile({ ...kai, published: true, hidden: true });
    assert.equal((await srv.request('/kai')).status, 404);

    store.putProfile({ ...kai, hidden: false, listed: false });
    assert.equal((await srv.request('/kai')).status, 200, 'nicht gelistet heißt nur: nicht in der Liste');
    assert.doesNotMatch((await srv.request('/')).text, /href="\/kai"/);

    store.putDiscord('100000000000000002', { ...store.getDiscord('100000000000000002'), inGuild: false });
    assert.equal((await srv.request('/kai')).status, 404);
    discord.members.delete('100000000000000002');
  });

  await t.test('Aufrufe zählen nur echte Besucher, einmal', async () => {
    const before = store.getProfile('100000000000000001').views;
    await srv.request('/luna', { headers: { 'User-Agent': BROWSER_UA } });
    await srv.request('/luna', { headers: { 'User-Agent': BROWSER_UA } });
    await srv.request('/luna', { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0)' } });
    assert.equal(store.getProfile('100000000000000001').views, before + 1);
  });

  await t.test('Unbekannte Seiten & robots.txt', async () => {
    assert.equal((await srv.request('/gibtsnicht')).status, 404);
    assert.equal((await srv.request('/api/gibtsnicht')).status, 404);
    assert.match((await srv.request('/robots.txt')).text, /Disallow: \//);
  });
});

test('Website: Login & Editor', async (t) => {
  const { store, srv } = await setup();
  t.after(() => srv.close());
  const LUNA = '100000000000000001';

  await t.test('kaputter Login-Link', async () => {
    const res = await srv.request('/login?token=quatsch');
    assert.equal(res.status, 400);
    assert.match(res.text, /abgelaufen/);
  });

  await t.test('GET /login verbraucht den Link noch nicht', async () => {
    const token = store.createLoginToken(LUNA, 60_000);
    const res = await srv.request(`/login?token=${token}`);
    assert.equal(res.status, 200);
    assert.match(res.text, /Hey User 01/);
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
    assert.ok(store.peekLoginToken(token));
  });

  await t.test('POST /login ohne eigene Herkunft wird blockiert (CSRF)', async () => {
    const token = store.createLoginToken(LUNA, 60_000);
    const body = `token=${token}`;
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
    assert.equal((await srv.request('/login', { method: 'POST', origin: null, headers, body })).status, 403);
    assert.equal((await srv.request('/login', { method: 'POST', origin: 'https://evil.example', headers, body })).status, 403);
    assert.equal((await srv.request('/login', { method: 'POST', origin: null, headers: { ...headers, 'Sec-Fetch-Site': 'cross-site' }, body })).status, 403);
    assert.ok(store.peekLoginToken(token), 'blockierte Versuche verbrauchen den Link nicht');
  });

  await t.test('Login-Link funktioniert genau einmal', async () => {
    const token = store.createLoginToken(LUNA, 60_000);
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `token=${token}` };
    const first = await srv.request('/login', opts);
    assert.equal(first.status, 303);
    assert.equal(first.headers.get('location'), '/edit');
    assert.match(first.headers.get('set-cookie'), /sid=.+HttpOnly.+SameSite=Lax/i);
    const second = await srv.request('/login', opts);
    assert.equal(second.status, 400);
  });

  await t.test('Editor nur mit Sitzung', async () => {
    assert.equal((await srv.request('/edit')).status, 401);
    const cookie = await srv.login(LUNA);
    const res = await srv.request('/edit', { cookie });
    assert.equal(res.status, 200);
    assert.match(res.text, /id="ed-data"/);
    assert.match(res.headers.get('cache-control'), /no-store/);
    const data = JSON.parse(res.text.match(/<script type="application\/json" id="ed-data">(.*?)<\/script>/s)[1]);
    assert.equal(data.profile.slug, 'luna');
  });

  await t.test('Profil speichern: bereinigt & gespeichert', async () => {
    const cookie = await srv.login(LUNA);
    const res = await srv.request('/api/me/profile', {
      method: 'PUT',
      cookie,
      json: { profile: { bio: '<b>Hi</b>', views: 1e9, hidden: false, userId: 'x', theme: { effect: 'snow', accent: '#123456' }, links: [{ url: 'youtube.com/@luna' }, { url: 'javascript:alert(1)' }] } },
    });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.profile.bio, '<b>Hi</b>', 'als Text gespeichert, beim Anzeigen escaped');
    assert.deepEqual(res.json.profile.links, [{ url: 'https://youtube.com/@luna', label: '' }]);
    const stored = store.getProfile(LUNA);
    assert.equal(stored.userId, LUNA);
    assert.notEqual(stored.views, 1e9);
    assert.equal(stored.theme.effect, 'snow');
    const page = await srv.request('/luna');
    assert.match(page.text, /&lt;b&gt;Hi&lt;\/b&gt;/);
  });

  await t.test('PUT ohne gleiche Herkunft oder ohne Sitzung wird abgelehnt', async () => {
    const cookie = await srv.login(LUNA);
    assert.equal((await srv.request('/api/me/profile', { method: 'PUT', cookie, origin: 'https://evil.example', json: { profile: {} } })).status, 403);
    assert.equal((await srv.request('/api/me/profile', { method: 'PUT', json: { profile: {} } })).status, 401);
  });

  await t.test('Profil-Adresse ändern', async () => {
    const cookie = await srv.login(LUNA);
    const taken = await srv.request('/api/me/profile', { method: 'PUT', cookie, json: { profile: { slug: 'kai' } } });
    assert.equal(taken.status, 422);
    assert.equal(taken.json.field, 'slug');
    const reserved = await srv.request('/api/me/profile', { method: 'PUT', cookie, json: { profile: { slug: 'edit' } } });
    assert.equal(reserved.status, 422);

    const check = await srv.request('/api/slug?slug=mond', { cookie });
    assert.equal(check.json.available, true);
    const ok = await srv.request('/api/me/profile', { method: 'PUT', cookie, json: { profile: { slug: 'Mond' } } });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.url, `${srv.base}/mond`);
    assert.equal((await srv.request('/mond')).status, 200);
    assert.equal((await srv.request('/luna')).status, 404);
  });

  await t.test('Besitzer sieht sein privates Profil mit Hinweis', async () => {
    const cookie = await srv.login(LUNA);
    await srv.request('/api/me/profile', { method: 'PUT', cookie, json: { profile: { published: false } } });
    assert.equal((await srv.request('/mond')).status, 404);
    const own = await srv.request('/mond', { cookie });
    assert.equal(own.status, 200);
    assert.match(own.text, /nur du siehst es/);
  });

  await t.test('Live-Status nur für öffentliche Profile', async () => {
    const kaiId = '100000000000000002';
    assert.equal((await srv.request('/api/live/100000000000000001')).status, 404);
    const res = await srv.request(`/api/live/${kaiId}`);
    assert.equal(res.status, 200);
    assert.equal(res.json.status, null);
  });

  await t.test('Abmelden', async () => {
    const cookie = await srv.login(LUNA);
    const res = await srv.request('/logout', { method: 'POST', cookie });
    assert.equal(res.status, 303);
    assert.equal((await srv.request('/edit', { cookie })).status, 401);
  });
});

test('Website: Bild-Upload & Löschen', async (t) => {
  const { store, srv } = await setup();
  t.after(() => srv.close());
  const LUNA = '100000000000000001';
  const KAI = '100000000000000002';
  const cookie = await srv.login(LUNA);

  const png = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#ff00aa' } })
    .withMetadata({ exif: { IFD0: { Copyright: 'GEHEIM-GPS' } } })
    .jpeg()
    .toBuffer();
  let uploaded;

  await t.test('Upload wird zu WebP ohne Metadaten', async () => {
    const res = await srv.request('/api/me/upload?kind=background', { method: 'POST', cookie, headers: { 'Content-Type': 'image/jpeg' }, body: png });
    assert.equal(res.status, 200, res.text);
    assert.match(res.json.url, /^\/uploads\/[a-f0-9]{24}\.webp$/);
    uploaded = res.json.url;
    const file = path.join(store.uploadDir, path.basename(uploaded));
    const meta = await sharp(file).metadata();
    assert.equal(meta.format, 'webp');
    assert.equal(meta.exif, undefined, 'EXIF entfernt');
    assert.equal(fs.readFileSync(file).includes('GEHEIM-GPS'), false);
    const served = await fetch(srv.base + uploaded);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get('content-type'), 'image/webp');
  });

  await t.test('Kein Bild / zu groß / ohne Login', async () => {
    const bad = await srv.request('/api/me/upload', { method: 'POST', cookie, headers: { 'Content-Type': 'image/png' }, body: Buffer.from('<svg onload=alert(1)>') });
    assert.equal(bad.status, 422);
    const big = await srv.request('/api/me/upload', { method: 'POST', cookie, headers: { 'Content-Type': 'image/png' }, body: Buffer.alloc(2 * 1024 * 1024) });
    assert.equal(big.status, 413);
    const anon = await srv.request('/api/me/upload', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: png });
    assert.equal(anon.status, 401);
  });

  await t.test('Eigenes Bild als Hintergrund setzen, fremdes nicht', async () => {
    const ok = await srv.request('/api/me/profile', { method: 'PUT', cookie, json: { profile: { theme: { bgType: 'image', bgImage: uploaded } } } });
    assert.equal(ok.json.profile.theme.bgImage, uploaded);
    assert.equal(ok.json.profile.theme.bgType, 'image');
    assert.match((await srv.request('/luna')).text, new RegExp(uploaded.replace(/\./g, '\\.')));

    const kaiCookie = await srv.login(KAI);
    const steal = await srv.request('/api/me/profile', { method: 'PUT', cookie: kaiCookie, json: { profile: { theme: { bgType: 'image', bgImage: uploaded } } } });
    assert.equal(steal.json.profile.theme.bgImage, '');
    assert.equal(steal.json.profile.theme.bgType, 'gradient');
  });

  await t.test('Aufräumen löscht nur ungenutzte, alte Bilder', async () => {
    const orphan = await srv.request('/api/me/upload?kind=banner', { method: 'POST', cookie, headers: { 'Content-Type': 'image/jpeg' }, body: png });
    const orphanFile = path.join(store.uploadDir, path.basename(orphan.json.url));
    assert.equal(collectUploadGarbage({ store, log: silentLog }), 0, 'frische Uploads bleiben (Schonfrist)');
    assert.equal(collectUploadGarbage({ store, log: silentLog, now: Date.now() + 7 * 3600_000 }), 1);
    assert.equal(fs.existsSync(orphanFile), false);
    assert.equal(fs.existsSync(path.join(store.uploadDir, path.basename(uploaded))), true, 'benutztes Bild bleibt');
  });

  await t.test('Profil löschen entfernt Profil, Bilder & Sitzung', async () => {
    const res = await srv.request('/api/me', { method: 'DELETE', cookie });
    assert.equal(res.status, 200);
    assert.equal(store.getProfile(LUNA), null);
    assert.equal(fs.existsSync(path.join(store.uploadDir, path.basename(uploaded))), false);
    assert.equal((await srv.request('/luna')).status, 404);
    assert.equal((await srv.request('/edit', { cookie })).status, 401);
  });
});
