/**
 * Upload the latest local electron-builder artifacts to GitHub Releases.
 * Requires GH_TOKEN or GITHUB_TOKEN with repo write access.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readBuildDirMarker, root } from './electron-build-path.mjs';

function fail(message) {
  console.error(message);
  process.exit(1);
}

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  fail(`GitHub token missing (401 Bad credentials).

Create a Personal Access Token with "repo" scope:
  https://github.com/settings/tokens

Then in PowerShell (same terminal):
  $env:GH_TOKEN = "ghp_your_token_here"
  npm run electron:publish

Or build + publish in one step:
  npm run electron:build:release
`);
}

const buildDir = readBuildDirMarker();
if (!buildDir || !fs.existsSync(buildDir)) {
  fail('No local build found. Run: npm run electron:build:release');
}

const names = fs.readdirSync(buildDir);
const exe = names.find(
  (name) =>
    /^Alpha/i.test(name) &&
    name.endsWith('.exe') &&
    !name.toLowerCase().includes('uninstaller')
);
const blockmap = names.find((name) => name.endsWith('.exe.blockmap'));
const latestYml = names.includes('latest.yml') ? 'latest.yml' : null;

if (!exe || !blockmap) {
  fail(`Installer not found in:\n  ${buildDir}\nRun: npm run electron:build:release`);
}

const uploadFiles = [
  path.join(buildDir, exe),
  path.join(buildDir, blockmap),
];
if (latestYml) {
  uploadFiles.push(path.join(buildDir, latestYml));
} else {
  console.warn('Warning: latest.yml missing — auto-update may not work until you rebuild.');
}

console.log('Publishing to GitHub Releases (olfasahnoun01/remix-of-grosafe-inventory-hub-de9c3b04):');
for (const file of uploadFiles) {
  console.log(`  - ${path.basename(file)}`);
}

const args = [
  'electron-builder',
  'publish',
  ...uploadFiles.flatMap((file) => ['--files', file]),
  '-p',
  'always',
];

const result = spawnSync('npx', args, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    GH_TOKEN: token,
    GITHUB_TOKEN: token,
  },
});

if ((result.status ?? 1) !== 0) {
  fail('GitHub publish failed. Check token scopes and repo access.');
}

console.log('\nPublished. Verify:');
console.log('  https://github.com/olfasahnoun01/remix-of-grosafe-inventory-hub-de9c3b04/releases');
process.exit(0);
