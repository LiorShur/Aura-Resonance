// Cross-platform emulator launcher with persistence. The Firebase emulators are
// in-memory by default, so seeded data is lost on every restart. This imports
// from ./emulator-data on start and exports back to it on exit (Ctrl+C), so you
// seed once and keep your data across restarts.
//
// `--import` errors if the directory is missing, so we create it first — that is
// the only reason this is a Node script and not a plain npm one-liner (mkdir -p
// is not portable to Windows npm shells).

import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';

const DATA_DIR = './emulator-data';
mkdirSync(DATA_DIR, { recursive: true });

const args = [
  'emulators:start',
  '--project',
  'demo-aura-resonance',
  '--import',
  DATA_DIR,
  '--export-on-exit',
  DATA_DIR,
];

// shell:true resolves firebase(.cmd) on Windows; stdio:inherit forwards Ctrl+C
// to the emulator so it runs its export-on-exit before quitting.
const child = spawn('firebase', args, { stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
