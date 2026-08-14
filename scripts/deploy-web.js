// Publishes the built dist/ folder to the gh-pages branch.
// Uses a throwaway git repo inside dist/ and force-pushes, which reliably
// includes every file (the gh-pages npm package skips the assets/node_modules
// font folder). Run after `npm run build:web` — or just use `npm run deploy`.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const REPO = 'https://github.com/Kuwguap/safealert.git';

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/ not built — run "npm run build:web" first.');
  process.exit(1);
}

const gitDir = path.join(dist, '.git');
if (fs.existsSync(gitDir)) fs.rmSync(gitDir, { recursive: true, force: true });

const run = (cmd) => execSync(cmd, { cwd: dist, stdio: 'inherit', shell: true });
run('git init -q');
run('git checkout -q -B gh-pages');
run('git add -A');
run('git -c user.email=deploy@safealert.gh -c user.name=deploy commit -qm "Deploy SafeAlert web build"');
run(`git push -q -f ${REPO} gh-pages`);
fs.rmSync(gitDir, { recursive: true, force: true });

console.log('\nDeployed to https://kuwguap.github.io/safealert/  (allow ~1 min for GitHub Pages to rebuild)');
