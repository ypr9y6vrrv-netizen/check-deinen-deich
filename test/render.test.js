import test from 'node:test';
import assert from 'node:assert/strict';
import { renderProfile, safeImageUrl, esc } from '../src/shared/render.js';
import { defaultProfile, sanitizeProfile, todayKey } from '../src/shared/profile.js';
import { snapshot } from './helpers.js';

const XSS = '"><img src=x onerror=alert(1)><script>alert(1)</script>';

function render(profileInput = {}, { discord = snapshot('1000000000000000001'), presence = null } = {}) {
  const profile = sanitizeProfile(profileInput, defaultProfile({ userId: '1000000000000000001', slug: 'test' }));
  return renderProfile({ profile, discord, presence, site: { name: 'Testserver' } });
}

test('esc maskiert alle HTML-Sonderzeichen', () => {
  assert.equal(esc(`<a href="x" title='y'>&</a>`), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
});

test('safeImageUrl lässt nur eigene Uploads & Discord-CDN durch', () => {
  assert.equal(safeImageUrl('/uploads/0123456789abcdef01234567.webp'), '/uploads/0123456789abcdef01234567.webp');
  assert.equal(safeImageUrl('https://cdn.discordapp.com/avatars/1/a.png'), 'https://cdn.discordapp.com/avatars/1/a.png');
  assert.equal(safeImageUrl('/static/demo/luna.svg'), '/static/demo/luna.svg');
  for (const bad of ['https://evil.com/x.png', 'http://cdn.discordapp.com/a.png', 'javascript:alert(1)', '/uploads/../db.json', '/static/../src/x.js', 'data:image/svg+xml,<svg>']) {
    assert.equal(safeImageUrl(bad), '', bad);
  }
});

test('Nutzereingaben werden überall escaped (kein XSS)', () => {
  const html = render({
    displayName: XSS,
    tagline: XSS,
    bio: XSS,
    pronouns: XSS,
    location: XSS,
    tags: [XSS],
    fields: [{ label: XSS, value: XSS }],
    links: [{ url: 'https://example.com/"onmouseover="alert(1)', label: XSS }],
  }, {
    discord: snapshot('1000000000000000001', {
      username: XSS,
      displayName: XSS,
      roles: [{ id: 'r', name: XSS, color: 'red;background:url(//evil)', color2: null, icon: 'https://evil.com/x.png', emoji: XSS }],
      guildTag: { tag: XSS, badge: 'javascript:alert(1)' },
      avatar: 'javascript:alert(1)',
    }),
    presence: {
      status: 'online"><script>',
      custom: { text: XSS, emoji: { name: XSS, url: 'https://evil.com/e.png' } },
      activity: { type: 'playing', name: XSS, details: XSS, state: XSS, image: 'https://evil.com/i.png', startedAt: Date.now() },
    },
  });
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img src=x/i);
  assert.doesNotMatch(html, /evil\.com/);
  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /"onmouseover=/);
  assert.doesNotMatch(html, /url\(\/\/evil\)/);
  assert.match(html, /&lt;script&gt;/);
});

test('Sichtbarkeits-Schalter blenden Bereiche aus', () => {
  const presence = { status: 'dnd', custom: { text: 'brb', emoji: null }, activity: { type: 'playing', name: 'Valorant', details: null, state: null, image: null, startedAt: null } };
  const all = render({}, { presence });
  assert.match(all, /pf-status--dnd/);
  assert.match(all, /Spielt/);
  assert.match(all, /Mitglied<\/li>|Mitglied</);
  assert.match(all, /@user01/);
  assert.match(all, /Aufrufe/);

  const none = render({ show: { username: false, roles: false, joined: false, created: false, status: false, activity: false, views: false } }, { presence });
  assert.doesNotMatch(none, /pf-status/);
  assert.doesNotMatch(none, /Spielt/);
  assert.doesNotMatch(none, /Rollen/);
  assert.doesNotMatch(none, /@user01/);
  assert.doesNotMatch(none, /Aufrufe/);
  assert.doesNotMatch(none, /brb/);
});

test('Links, Song & Geburtstag werden gerendert', () => {
  const html = render({
    links: [{ url: 'https://www.instagram.com/luna', label: '' }],
    song: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
    birthday: todayKey(),
  });
  assert.match(html, /class="pf-link"/);
  assert.match(html, />Instagram</);
  assert.match(html, /rel="noopener noreferrer nofollow ugc"/);
  assert.match(html, /data-embed="https:\/\/open\.spotify\.com\/embed\/track\/4cOdK2wGLETKBW3PvgPWqT"/);
  assert.doesNotMatch(html, /<iframe/, 'Song wird erst nach Klick geladen');
  assert.match(html, /Hat heute Geburtstag/);

  const icons = render({ links: [{ url: 'https://github.com/x' }], theme: { linkStyle: 'icons' } });
  assert.match(icons, /pf-icon-link/);
  assert.doesNotMatch(icons, /class="pf-link"/);
});

test('Theme landet als CSS-Variablen & Klassen auf der Wurzel', () => {
  const html = render({ theme: { accent: '#ff0055', font: 'pixel', cardStyle: 'neon', nameEffect: 'glitch', effect: 'matrix', tone: 'light' } });
  assert.match(html, /--accent:#ff0055/);
  assert.match(html, /pf--card-neon/);
  assert.match(html, /pf--name-glitch/);
  assert.match(html, /pf--tone-light/);
  assert.match(html, /data-effect="matrix"/);
  assert.match(html, /Press Start 2P/);
});

test('ohne Avatar gibt es Initialen', () => {
  const html = render({ displayName: 'zora' }, { discord: { username: 'zora' } });
  assert.match(html, /pf-avatar-fallback">Z</);
});
