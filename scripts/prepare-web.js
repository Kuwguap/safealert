// Post-processes the `expo export -p web` output in dist/ for GitHub Pages:
//  - injects PWA manifest + Apple "add to home screen" meta so it installs
//    like a native app
//  - copies index.html -> 404.html so client-side routes (e.g. /admin) resolve
//  - adds .nojekyll so the _expo/ folder is served
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const BASE = '/safealert';

// App icon for the manifest + Apple touch icon
fs.copyFileSync(path.join(__dirname, '..', 'assets', 'icon.png'), path.join(dist, 'icon.png'));

const manifest = {
  name: 'SafeAlert',
  short_name: 'SafeAlert',
  description: 'Location-aware emergency alerts for Ghana — AMBER, floods, weather, SOS.',
  start_url: `${BASE}/`,
  scope: `${BASE}/`,
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#faf7f1',
  theme_color: '#b45309',
  icons: [
    { src: `${BASE}/icon.png`, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: `${BASE}/icon.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
};
fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2));

const head = `
  <link rel="manifest" href="${BASE}/manifest.json" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="SafeAlert" />
  <link rel="apple-touch-icon" href="${BASE}/icon.png" />
</head>`;

const indexPath = path.join(dist, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8').replace('</head>', head);
fs.writeFileSync(indexPath, html);

// SPA fallback + Jekyll opt-out
fs.copyFileSync(indexPath, path.join(dist, '404.html'));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

console.log('prepare-web: manifest, PWA meta, 404.html and .nojekyll written to dist/');
