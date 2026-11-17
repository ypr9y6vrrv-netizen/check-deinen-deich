import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanText, normalizeUrl, detectPlatform, defaultLinkLabel, parseSong, slugify, validateSlug, normalizeBirthday,
  birthdayLabel, todayKey, sanitizeProfile, defaultProfile, LIMITS, readableTextOn, hexToRgbTriplet,
} from '../src/shared/profile.js';

test('cleanText entfernt Steuerzeichen, Bidi-Tricks und kürzt sauber', () => {
  assert.equal(cleanText('  Hallo\u0000 Welt‮  ', 50), 'Hallo Welt');
  assert.equal(cleanText('a\n\n\n\n\nb', 50, { multiline: true }), 'a\n\nb');
  assert.equal(cleanText('Zeile1\nZeile2', 50), 'Zeile1 Zeile2');
  assert.equal(cleanText('😀😀😀', 2), '😀😀', 'Emojis werden nicht zerschnitten');
  assert.equal(cleanText(null, 5), '');
  assert.equal(cleanText(12345, 3), '123');
});

test('normalizeUrl akzeptiert nur http(s)', () => {
  assert.equal(normalizeUrl('instagram.com/luna'), 'https://instagram.com/luna');
  assert.equal(normalizeUrl('https://x.com/a?b=1'), 'https://x.com/a?b=1');
  assert.equal(normalizeUrl('example.com:8080/x'), 'https://example.com:8080/x');
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,hi', 'mailto:a@b.de', 'ftp://x.de', 'https://user:pw@x.com', 'localhost', '', '   ', 'https://x']) {
    assert.equal(normalizeUrl(bad), null, bad);
  }
  assert.equal(normalizeUrl(`https://x.com/${'a'.repeat(400)}`), null, 'zu lang');
});

test('detectPlatform erkennt Plattformen inkl. Subdomains', () => {
  assert.equal(detectPlatform('https://www.instagram.com/x'), 'instagram');
  assert.equal(detectPlatform('https://vm.tiktok.com/abc'), 'tiktok');
  assert.equal(detectPlatform('https://youtu.be/abc'), 'youtube');
  assert.equal(detectPlatform('https://twitter.com/x'), 'x');
  assert.equal(detectPlatform('https://artist.bandcamp.com'), 'bandcamp');
  assert.equal(detectPlatform('https://steamcommunity.com/id/x'), 'steam');
  assert.equal(detectPlatform('https://evil-instagram.com'), 'website');
  assert.equal(detectPlatform('https://instagram.com.evil.de'), 'website');
  assert.equal(detectPlatform('kaputt'), 'website');
  assert.equal(defaultLinkLabel('https://www.twitch.tv/x'), 'Twitch');
  assert.equal(defaultLinkLabel('https://www.meine-seite.de/blog'), 'meine-seite.de');
});

test('parseSong baut Einbettungs-URLs für Spotify, YouTube & SoundCloud', () => {
  assert.deepEqual(parseSong('https://open.spotify.com/intl-de/track/4cOdK2wGLETKBW3PvgPWqT?si=x'), {
    provider: 'spotify', label: 'Spotify', embed: 'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT', height: 152,
  });
  assert.equal(parseSong('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M').height, 352);
  assert.equal(parseSong('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10').embed, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
  assert.equal(parseSong('https://youtu.be/dQw4w9WgXcQ').provider, 'youtube');
  assert.equal(parseSong('https://www.youtube.com/shorts/dQw4w9WgXcQ').provider, 'youtube');
  assert.match(parseSong('https://soundcloud.com/artist/track-name').embed, /^https:\/\/w\.soundcloud\.com\/player\/\?url=https%3A%2F%2Fsoundcloud\.com%2Fartist%2Ftrack-name/);
  assert.equal(parseSong('https://www.youtube.com/watch?v=<script>'), null);
  assert.equal(parseSong('http://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT'), null, 'nur https');
  assert.equal(parseSong('https://example.com/song.mp3'), null);
});

test('slugify & validateSlug', () => {
  assert.equal(slugify('Jürgen Größe!!'), 'juergen-groesse');
  assert.equal(slugify('luna.exe'), 'luna.exe');
  assert.equal(slugify('__x__'), '');
  assert.equal(slugify('Ÿ'), '');
  assert.equal(validateSlug('luna'), null);
  assert.match(validateSlug('a'), /Mindestens/);
  assert.match(validateSlug('edit'), /reserviert/);
  assert.match(validateSlug('-luna'), /Nur/);
  assert.match(validateSlug('Luna'), /Nur/, 'Großbuchstaben werden vorher kleingemacht');
  assert.match(validateSlug('x'.repeat(40)), /Höchstens/);
});

test('Geburtstag: ohne Jahr, nur gültige Daten', () => {
  assert.equal(normalizeBirthday('02-29'), '02-29');
  assert.equal(normalizeBirthday('02-30'), '');
  assert.equal(normalizeBirthday('13-01'), '');
  assert.equal(normalizeBirthday('1999-01-01'), '');
  assert.equal(birthdayLabel('11-17'), '17. November');
  assert.equal(todayKey(Date.parse('2026-11-17T23:30:00Z')), '11-18', 'deutsche Zeitzone');
});

test('Farb-Helfer', () => {
  assert.equal(hexToRgbTriplet('#ff8000'), '255 128 0');
  assert.equal(readableTextOn('#ffffff'), '#0b0b0f');
  assert.equal(readableTextOn('#101010'), '#ffffff');
});

test('sanitizeProfile übernimmt nur erlaubte Felder und bereinigt sie', () => {
  const base = defaultProfile({ userId: '42', slug: 'luna', presetKey: 'midnight' });
  base.views = 7;
  const input = {
    userId: 'hacker',
    views: 999999,
    hidden: false,
    createdAt: 1,
    displayName: 'x'.repeat(100),
    bio: 'Hallo\r\n\r\n\r\nWelt',
    tags: ['#Gaming', 'gaming', '', 'Musik', ...Array.from({ length: 20 }, (_, i) => `t${i}`)],
    fields: [{ label: 'Main', value: 'Jett' }, { label: '', value: 'leer' }, 'kaputt'],
    links: [{ url: 'twitch.tv/x', label: 'Live' }, { url: 'javascript:alert(1)' }, { url: 'https://ok.de' }],
    song: 'https://example.com/song.mp3',
    birthday: '02-31',
    slug: '  NeuerName ',
    theme: {
      accent: 'red', bg1: '#ABCDEF', bgAngle: 9999, bgDim: -5, effect: 'feuerwerk', font: 'pixel',
      bgImage: '/uploads/../../etc/passwd', bgType: 'image', cardStyle: 'neon', banner: 'image', bannerImage: '',
    },
    show: { roles: false, views: 'ja' },
    evil: '<script>',
  };
  const p = sanitizeProfile(input, base);

  assert.equal(p.userId, '42');
  assert.equal(p.views, 7);
  assert.equal(p.createdAt, base.createdAt);
  assert.equal(p.displayName.length, LIMITS.displayName);
  assert.equal(p.bio, 'Hallo\n\nWelt');
  assert.deepEqual(p.tags.slice(0, 2), ['Gaming', 'Musik']);
  assert.equal(p.tags.length, LIMITS.tagCount);
  assert.deepEqual(p.fields, [{ label: 'Main', value: 'Jett' }]);
  assert.deepEqual(p.links, [{ url: 'https://twitch.tv/x', label: 'Live' }, { url: 'https://ok.de/', label: '' }]);
  assert.equal(p.song, '');
  assert.equal(p.birthday, '');
  assert.equal(p.slug, 'neuername');
  assert.equal(p.theme.accent, base.theme.accent);
  assert.equal(p.theme.bg1, '#abcdef');
  assert.equal(p.theme.bgAngle, 360);
  assert.equal(p.theme.bgDim, 0);
  assert.equal(p.theme.effect, base.theme.effect);
  assert.equal(p.theme.font, 'pixel');
  assert.equal(p.theme.bgImage, '', 'Pfad-Tricks werden verworfen');
  assert.equal(p.theme.bgType, 'gradient', 'Bild-Hintergrund ohne Bild fällt zurück');
  assert.equal(p.theme.banner, 'discord');
  assert.equal(p.show.roles, false);
  assert.equal(p.show.views, true, 'Nicht-Boolean wird ignoriert');
  assert.equal('evil' in p, false);
});

test('sanitizeProfile lässt fehlende Felder unverändert', () => {
  const base = defaultProfile({ userId: '1', slug: 'abc' });
  base.bio = 'bleibt';
  const p = sanitizeProfile({ theme: { effect: 'snow' } }, base);
  assert.equal(p.bio, 'bleibt');
  assert.equal(p.theme.effect, 'snow');
  assert.equal(p.slug, 'abc');
  assert.deepEqual(sanitizeProfile(undefined, base).theme, base.theme);
});
