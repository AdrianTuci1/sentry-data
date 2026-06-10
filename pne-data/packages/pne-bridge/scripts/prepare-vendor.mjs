#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bridgeRoot = resolve(__dirname, '..');
const repoPackagesDir = resolve(bridgeRoot, '..');
const vendorRoot = resolve(bridgeRoot, 'vendor');
const widgetSourceFile = resolve(repoPackagesDir, '..', 'r2-system', 'widgets', 'index.js');
const widgetTargetDir = resolve(bridgeRoot, 'widgets');

const packages = [
  'connector-sdk',
  'observability',
  'pne-core',
  'sentinel-core',
  'sentinel-domain-packs',
  'codex-adapter',
  'agent-playbooks',
  'widget-contracts',
  'ml-contracts',
  'powerbi-adapter'
];

rmSync(vendorRoot, { recursive: true, force: true });
mkdirSync(vendorRoot, { recursive: true });

for (const packageName of packages) {
  const sourceDir = resolve(repoPackagesDir, packageName, 'dist');
  const targetDir = resolve(vendorRoot, packageName);

  if (!existsSync(sourceDir)) {
    throw new Error(`Missing built dist for ${packageName}. Run the package builds first.`);
  }

  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true });
  const jsEntry = resolve(targetDir, 'index.js');
  const cjsEntry = resolve(targetDir, 'index.cjs');
  if (existsSync(jsEntry)) {
    renameSync(jsEntry, cjsEntry);
  }
  writeFileSync(
    resolve(targetDir, 'package.json'),
    `${JSON.stringify({ type: 'commonjs', main: './index.cjs' }, null, 2)}\n`
  );
}

process.stdout.write(`Prepared vendored PNE dependencies in ${vendorRoot}\n`);

rmSync(widgetTargetDir, { recursive: true, force: true });
mkdirSync(widgetTargetDir, { recursive: true });
if (existsSync(widgetSourceFile)) {
  cpSync(widgetSourceFile, resolve(widgetTargetDir, 'index.js'));
}
