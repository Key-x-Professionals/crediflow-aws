#!/usr/bin/env node
/**
 * Revisión de buenas prácticas con cdk-nag (sesión 6):  npm run nag
 * Sintetiza la aplicación con CF_NAG=true. Funciona igual en Mac y en Windows.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const r = spawnSync('npx', ['cdk', 'synth', '--quiet'], {
  cwd: path.join(__dirname, '..', 'infra'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, CF_NAG: 'true' },
});
process.exit(r.status ?? 1);
