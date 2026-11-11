#!/usr/bin/env node
/**
 * Verificación del entorno de trabajo (Mac, Windows y Linux).
 *   node scripts/verify-setup.js
 *
 * Revisa versiones de las herramientas del curso y la configuración de AWS.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const checks = [
  { name: 'Node.js', cmd: 'node --version', min: 20, parse: (s) => Number(s.replace('v', '').split('.')[0]) },
  { name: 'npm', cmd: 'npm --version', min: 9, parse: (s) => Number(s.split('.')[0]) },
  { name: 'Git', cmd: 'git --version', min: 2, parse: (s) => Number(s.match(/(\d+)\./)[1]) },
  { name: 'AWS CLI v2 (>= 2.32)', cmd: 'aws --version', min: 232, minLabel: '2.32', parse: (s) => { const m = s.match(/aws-cli\/(\d+)\.(\d+)/); return Number(m[1]) * 100 + Number(m[2]); } },
  { name: 'Docker', cmd: 'docker --version', min: 20, parse: (s) => Number(s.match(/(\d+)\./)[1]), optional: true },
  { name: 'Session Manager plugin', cmd: 'session-manager-plugin --version', min: 1, parse: () => 1, optional: true },
  { name: 'GitHub CLI (gh)', cmd: 'gh --version', min: 2, parse: (s) => Number(s.match(/(\d+)\./)[1]), optional: true },
];

let ok = true;
console.log('\n=== CrediFlow · verificación del entorno ===\n');

for (const c of checks) {
  try {
    const out = execSync(c.cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim().split('\n')[0];
    const v = c.parse(out);
    const pass = v >= c.min;
    if (!pass && !c.optional) ok = false;
    console.log(`${pass ? '✅' : c.optional ? '⚠️ ' : '❌'} ${c.name.padEnd(24)} ${out}${pass ? '' : `  (se requiere >= ${c.minLabel ?? c.min})`}`);
  } catch {
    if (!c.optional) ok = false;
    console.log(`${c.optional ? '⚠️ ' : '❌'} ${c.name.padEnd(24)} no encontrado${c.optional ? ' (opcional hasta la sesión indicada en la guía)' : ''}`);
  }
}

// .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const env = Object.fromEntries(
    fs.readFileSync(envPath, 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => l.split('=').map((x) => x.trim())),
  );
  const student = env.CF_STUDENT ?? '';
  const studentOk = /^[a-z][a-z0-9-]{1,11}$/.test(student);
  console.log(`${studentOk ? '✅' : '❌'} .env CF_STUDENT          ${student || '(vacío)'}`);
  console.log(`${env.CDK_DEFAULT_ACCOUNT ? '✅' : '❌'} .env CDK_DEFAULT_ACCOUNT ${env.CDK_DEFAULT_ACCOUNT || '(vacío)'}`);
  if (!studentOk || !env.CDK_DEFAULT_ACCOUNT) ok = false;
} else {
  console.log('⚠️  .env                     no existe todavía (cp .env.example .env)');
}

// Identidad de AWS
try {
  const who = JSON.parse(execSync('aws sts get-caller-identity --output json', { stdio: ['ignore', 'pipe', 'pipe'] }).toString());
  console.log(`✅ Identidad AWS            ${who.Arn}`);
} catch {
  console.log('⚠️  Identidad AWS            sin sesión activa (aws login --profile crediflow)');
}

console.log(`\n${ok ? '🎉 Todo listo para la sesión.' : '⛔ Faltan requisitos. Revisa docs/00-preparacion/instalacion.md'}\n`);
process.exit(ok ? 0 : 1);
