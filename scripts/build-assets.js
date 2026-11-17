// Erzeugt die statischen Assets, die im Repo eingecheckt sind:
//   - src/shared/brand-icons.js  (Marken-Icons aus "simple-icons", CC0)
//   - public/fonts/*.woff2 + public/css/fonts.css (selbst gehostete Schriften, OFL)
// Ausführen mit: npm run assets   (braucht die devDependencies)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const pkgDirOf = (name) => path.join(root, 'node_modules', name);
const pkgVersion = (name) => JSON.parse(fs.readFileSync(path.join(pkgDirOf(name), 'package.json'), 'utf8')).version;

// ---------------------------------------------------------------- Icons
const si = require('simple-icons');
const bySlug = new Map();
for (const icon of Object.values(si)) if (icon && icon.slug) bySlug.set(icon.slug, icon);

const BRANDS = [
  'instagram', 'tiktok', 'youtube', 'twitch', 'kick', 'spotify', 'applemusic', 'soundcloud', 'deezer',
  'x', 'threads', 'bluesky', 'mastodon', 'reddit', 'snapchat', 'discord', 'telegram', 'whatsapp',
  'facebook', 'pinterest', 'tumblr', 'github', 'gitlab', 'steam', 'epicgames', 'playstation', 'roblox',
  'battledotnet', 'riotgames', 'faceit', 'osu', 'lastdotfm', 'letterboxd', 'myanimelist', 'anilist',
  'chessdotcom', 'lichess', 'paypal', 'kofi', 'patreon', 'buymeacoffee', 'linktree', 'vrchat',
  'itchdotio', 'artstation', 'deviantart', 'behance', 'bandcamp', 'namemc', 'medium', 'substack',
  'vimeo', 'imdb', 'duolingo', 'strava', 'bereal', 'wattpad', 'archiveofourown',
];

const icons = {};
for (const slug of BRANDS) {
  const icon = bySlug.get(slug);
  if (!icon) throw new Error(`simple-icons: "${slug}" nicht gefunden`);
  icons[slug] = { t: icon.title, c: `#${icon.hex}`, p: icon.path };
}

const iconFile = `// AUTOMATISCH ERZEUGT von scripts/build-assets.js – nicht von Hand bearbeiten.
// Marken-Icons aus "simple-icons" v${pkgVersion('simple-icons')} (CC0-1.0, https://simpleicons.org).
// Die Marken selbst gehören ihren jeweiligen Inhabern.
export const BRAND_ICONS = ${JSON.stringify(icons, null, 0).replace(/},"/g, '},\n  "').replace(/^{/, '{\n  ').replace(/}$/, '\n}')};
`;
fs.writeFileSync(path.join(root, 'src/shared/brand-icons.js'), iconFile);
console.log(`✓ ${Object.keys(icons).length} Marken-Icons → src/shared/brand-icons.js`);

// ---------------------------------------------------------------- Fonts
// key -> [fontsource-Paket, Gewichte]
const FONTS = {
  grotesk: ['space-grotesk', [500, 700]],
  futur: ['orbitron', [500, 800]],
  pixel: ['press-start-2p', [400]],
  elegant: ['playfair-display', [500, 800]],
  code: ['jetbrains-mono', [500, 800]],
  hand: ['caveat', [500, 700]],
  marker: ['permanent-marker', [400]],
};
const KEEP_SUBSETS = ['latin', 'latin-ext'];

const fontDir = path.join(root, 'public/fonts');
fs.rmSync(fontDir, { recursive: true, force: true });
fs.mkdirSync(fontDir, { recursive: true });

let css = `/* AUTOMATISCH ERZEUGT von scripts/build-assets.js – selbst gehostete Schriften (SIL Open Font License, via Fontsource).
   Selbst gehostet, damit keine Besucher-Daten an Google o. Ä. gehen. */\n`;
let copied = 0;
for (const [key, [pkg, weights]] of Object.entries(FONTS)) {
  const pkgDir = pkgDirOf(`@fontsource/${pkg}`);
  for (const weight of weights) {
    const src = fs.readFileSync(path.join(pkgDir, `${weight}.css`), 'utf8');
    const blocks = src.match(/\/\* [^*]+ \*\/\s*@font-face\s*{[^}]+}/g) || [];
    for (const block of blocks) {
      const subset = KEEP_SUBSETS.find((s) => block.includes(`-${s}-${weight}-normal */`));
      if (!subset) continue;
      const family = block.match(/font-family:\s*'([^']+)'/)[1];
      const range = block.match(/unicode-range:\s*([^;]+);/)[1];
      const file = `${pkg}-${subset}-${weight}-normal.woff2`;
      fs.copyFileSync(path.join(pkgDir, 'files', file), path.join(fontDir, file));
      copied++;
      css += `@font-face{font-family:'${family}';font-style:normal;font-display:swap;font-weight:${weight};` +
        `src:url(/static/fonts/${file}) format('woff2');unicode-range:${range}}\n`;
    }
  }
}
fs.writeFileSync(path.join(root, 'public/css/fonts.css'), css);
console.log(`✓ ${copied} Schrift-Dateien → public/fonts, public/css/fonts.css`);
