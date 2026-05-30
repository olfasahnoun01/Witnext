/**
 * Upload local electron-builder artifacts to GitHub Releases.
 * Uses the GitHub REST API directly (electron-builder 26.x "publish" subcommand
 * corrupts publish config when re-loading package.json).
 *
 * Requires GH_TOKEN or GITHUB_TOKEN with repo write access.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readBuildDirMarker, root } from './electron-build-path.mjs';

const API = 'https://api.github.com';
const UPLOAD = 'https://uploads.github.com';

function readPackageJson() {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
}

function resolveToken() {
  const fromEnv = (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '').trim();
  if (fromEnv) return { token: fromEnv, source: 'GH_TOKEN/GITHUB_TOKEN' };

  const gh = spawnSync('gh', ['auth', 'token'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const fromGh = (gh.stdout || '').trim();
  if (gh.status === 0 && fromGh) {
    return { token: fromGh, source: 'gh auth token' };
  }

  return null;
}

function tokenHint() {
  return `GitHub token missing or invalid.

1. Revoke any token you pasted in a terminal (it may be logged).
2. Create a new token:
   Classic PAT: https://github.com/settings/tokens
     - Enable scope: repo (full control of private repositories)
   Fine-grained PAT: https://github.com/settings/personal-access-tokens
     - Repository access: ${owner}/${repo}
     - Permissions: Contents = Read and write, Metadata = Read

3. Set it in the SAME PowerShell window, then publish:
   $env:GH_TOKEN = "your_new_token"
   npm run electron:publish

Or sign in with GitHub CLI (no manual token):
   gh auth login
   npm run electron:publish
`;
}

function readPublishTarget(pkg) {
  const publishCfg = pkg.build?.publish?.[0];
  return {
    owner: publishCfg?.owner || 'olfasahnoun01',
    repo: publishCfg?.repo || 'remix-of-grosafe-inventory-hub-de9c3b04',
  };
}

const pkg = readPackageJson();
const version = pkg.version;
const { owner, repo } = readPublishTarget(pkg);
const tag = `v${version}`;

const resolved = resolveToken();
if (!resolved) {
  console.error(tokenHint());
  process.exitCode = 1;
} else {
  const { token, source } = resolved;

  const buildDir = readBuildDirMarker();
  if (!buildDir || !fs.existsSync(buildDir)) {
    console.error('No local build found. Run: npm run electron:build');
    process.exitCode = 1;
  } else {
    const names = fs.readdirSync(buildDir);
    const exe = names.find(
      (name) =>
        /^Alpha/i.test(name) &&
        name.endsWith('.exe') &&
        !name.toLowerCase().includes('uninstaller')
    );
    const blockmap = names.find((name) => name.endsWith('.exe.blockmap'));

    if (!exe || !blockmap) {
      console.error(`Installer not found in:\n  ${buildDir}\nRun: npm run electron:build`);
      process.exitCode = 1;
    } else {
      function ensureLatestYml(installerName) {
        const ymlPath = path.join(buildDir, 'latest.yml');
        if (fs.existsSync(ymlPath)) return ymlPath;

        const installerPath = path.join(buildDir, installerName);
        const stat = fs.statSync(installerPath);
        const sha512 = crypto
          .createHash('sha512')
          .update(fs.readFileSync(installerPath))
          .digest('base64');

        const yml = [
          `version: ${version}`,
          'files:',
          `  - url: ${installerName}`,
          `    sha512: ${sha512}`,
          `    size: ${stat.size}`,
          `path: ${installerName}`,
          `sha512: ${sha512}`,
          `releaseDate: '${new Date().toISOString()}'`,
          '',
        ].join('\n');

        fs.writeFileSync(ymlPath, yml, 'utf8');
        console.log(`Generated latest.yml for ${installerName}`);
        return ymlPath;
      }

      const uploadFiles = [
        path.join(buildDir, exe),
        path.join(buildDir, blockmap),
        ensureLatestYml(exe),
      ];

      async function githubJson(route, options = {}) {
        const res = await fetch(`${API}${route}`, {
          ...options,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Alpha-Electron-Publish',
            'X-GitHub-Api-Version': '2022-11-28',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
          },
        });

        const text = await res.text();
        let data = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }

        if (!res.ok) {
          const detail =
            typeof data === 'object' && data?.message
              ? data.message
              : text || res.statusText;
          const err = new Error(`GitHub API ${res.status} ${route}: ${detail}`);
          err.status = res.status;
          throw err;
        }

        return data;
      }

      async function validateToken() {
        console.log(`Using token from ${source}`);
        try {
          const user = await githubJson('/user');
          console.log(`Authenticated as ${user.login}`);
        } catch (error) {
          if (error.status === 401) {
            throw new Error(
              'Token rejected by GitHub (401 Bad credentials).\n' +
                'The token is expired, revoked, mistyped, or not a GitHub PAT.\n' +
                tokenHint()
            );
          }
          throw error;
        }

        try {
          await githubJson(`/repos/${owner}/${repo}`);
        } catch (error) {
          if (error.status === 404) {
            throw new Error(
              `Repository not found or token cannot access ${owner}/${repo}.\n` +
                'Use a token for the account that owns this repo, with repo (classic) or Contents write (fine-grained).'
            );
          }
          if (error.status === 403) {
            throw new Error(
              `Token cannot read ${owner}/${repo} (403).\n` +
                'Grant repo scope (classic) or Contents: Read and write (fine-grained).'
            );
          }
          throw error;
        }
      }

      async function getOrCreateRelease() {
        const releases = await githubJson(`/repos/${owner}/${repo}/releases?per_page=100`);
        const existing = releases.find(
          (release) => release.tag_name === tag || release.tag_name === version
        );

        if (existing) {
          console.log(`Using existing release ${existing.tag_name} (id ${existing.id})`);
          return existing;
        }

        console.log(`Creating release ${tag}...`);
        return githubJson(`/repos/${owner}/${repo}/releases`, {
          method: 'POST',
          body: JSON.stringify({
            tag_name: tag,
            name: `${pkg.build?.productName || 'Alpha'} ${version}`,
            draft: false,
            prerelease: false,
            generate_release_notes: true,
          }),
        });
      }

      async function deleteAssetIfExists(releaseId, fileName) {
        const assets = await githubJson(
          `/repos/${owner}/${repo}/releases/${releaseId}/assets?per_page=100`
        );
        const asset = assets.find((item) => item.name === fileName);
        if (!asset) return;

        console.log(`  replacing existing ${fileName}`);
        await githubJson(`/repos/${owner}/${repo}/releases/assets/${asset.id}`, {
          method: 'DELETE',
        });
      }

      function contentTypeFor(fileName) {
        if (fileName.endsWith('.yml')) return 'text/yaml';
        if (fileName.endsWith('.blockmap')) return 'application/octet-stream';
        return 'application/vnd.microsoft.portable-executable';
      }

      async function uploadAsset(releaseId, filePath) {
        const fileName = path.basename(filePath);
        await deleteAssetIfExists(releaseId, fileName);

        const data = fs.readFileSync(filePath);
        const url = `${UPLOAD}/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': contentTypeFor(fileName),
            'Content-Length': String(data.length),
            'User-Agent': 'Alpha-Electron-Publish',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: data,
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Upload failed for ${fileName} (${res.status}): ${text}`);
        }

        console.log(`  uploaded ${fileName}`);
      }

      console.log(`Publishing to GitHub Releases (${owner}/${repo}, ${tag}):`);
      for (const file of uploadFiles) {
        console.log(`  - ${path.basename(file)}`);
      }

      try {
        await validateToken();
        const release = await getOrCreateRelease();
        for (const file of uploadFiles) {
          await uploadAsset(release.id, file);
        }
        console.log('\nPublished. Verify:');
        console.log(`  https://github.com/${owner}/${repo}/releases/tag/${tag}`);
      } catch (error) {
        console.error(`GitHub publish failed: ${error.message}`);
        process.exitCode = 1;
      }
    }
  }
}
