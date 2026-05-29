/**
 * Runs electron-builder with output outside the repo (see electron-build-path.mjs).
 */
import { spawnSync } from 'node:child_process';
import {
  allocateElectronBuildDir,
  root,
} from './electron-build-path.mjs';

const args = process.argv.slice(2);
const publishIdx = args.indexOf('--publish');
const publish =
  publishIdx >= 0 && args[publishIdx + 1] ? args[publishIdx + 1] : 'never';
const dirOnly = args.includes('--dir');

const outputDir = allocateElectronBuildDir();
console.log(`Electron build output: ${outputDir}`);

const builderArgs = [
  'electron-builder',
  '--win',
  '--publish',
  publish,
  `-c.directories.output=${outputDir}`,
];

if (dirOnly) {
  builderArgs.push('--config', 'electron-builder.dir.json');
}

const result = spawnSync('npx', builderArgs, {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
