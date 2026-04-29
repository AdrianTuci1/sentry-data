#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bridge = resolve(__dirname, '..', '..', '..', 'packages', 'pne-bridge', 'bin', 'pne.mjs');

const child = spawn(process.execPath, [bridge, 'analyze-json'], {
  stdio: ['inherit', 'inherit', 'inherit'],
  env: process.env
});

child.on('exit', (code) => process.exit(code ?? 0));
