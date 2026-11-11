#!/usr/bin/env node
/**
 * ¿Qué tengo encendido y cuánto llevo gastado?
 *   npm run costos
 *
 * 1. Lista los recursos con tu etiqueta Student (lo que sigue existiendo en la cuenta).
 * 2. Consulta Cost Explorer: gasto del mes filtrado por tu etiqueta (los datos tardan ~24 h).
 * Usa la AWS CLI con tu sesión de aws login; no necesita dependencias.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const env = fs.existsSync(envPath)
  ? Object.fromEntries(fs.readFileSync(envPath, 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => l.split('=').map((x) => x.trim())))
  : {};
const student = process.env.CF_STUDENT ?? env.CF_STUDENT;
if (!student) {
  console.error('Falta CF_STUDENT (en .env o como variable de entorno)');
  process.exit(1);
}

function aws(args) {
  return JSON.parse(execSync(`aws ${args} --output json`, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, AWS_PAGER: '' } }).toString() || '{}');
}

console.log(`\n=== CrediFlow · recursos y costos de "${student}" ===\n`);

// 1. Recursos vivos
try {
  const res = aws(`resourcegroupstaggingapi get-resources --tag-filters Key=Student,Values=${student}`);
  const arns = (res.ResourceTagMappingList ?? []).map((r) => r.ResourceARN);
  const porServicio = {};
  for (const arn of arns) {
    const svc = arn.split(':')[2];
    porServicio[svc] = (porServicio[svc] ?? 0) + 1;
  }
  console.log(`Recursos con etiqueta Student=${student}: ${arns.length}`);
  for (const [svc, n] of Object.entries(porServicio).sort()) console.log(`  ${svc.padEnd(22)} ${n}`);
  const caros = arns.filter((a) => /elasticloadbalancing:.*loadbalancer|:natgateway\/|:rds:|:ecs:.*service\/|:ec2:.*instance\//.test(a));
  if (caros.length) {
    console.log('\n⚠️  Recursos que cobran POR HORA aunque no se usen (apágalos al terminar la sesión):');
    caros.forEach((a) => console.log('  -', a));
  } else {
    console.log('\n✅ No hay recursos con costo por hora (ALB, NAT, RDS, ECS, EC2) encendidos.');
  }
} catch (e) {
  console.log('No se pudieron listar los recursos:', e.message.split('\n')[0]);
}

// 2. Gasto del mes
try {
  const now = new Date();
  const start = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const end = now.toISOString().slice(0, 10);
  if (start !== end) {
    const ce = aws(
      `ce get-cost-and-usage --time-period Start=${start},End=${end} --granularity MONTHLY --metrics UnblendedCost --group-by Type=DIMENSION,Key=SERVICE --filter '{"Tags":{"Key":"Student","Values":["${student}"]}}'`,
    );
    const groups = ce.ResultsByTime?.[0]?.Groups ?? [];
    let total = 0;
    console.log(`\nGasto del mes (${start} → ${end}) etiquetado Student=${student}:`);
    for (const g of groups.sort((a, b) => Number(b.Metrics.UnblendedCost.Amount) - Number(a.Metrics.UnblendedCost.Amount))) {
      const amt = Number(g.Metrics.UnblendedCost.Amount);
      total += amt;
      if (amt >= 0.005) console.log(`  ${g.Keys[0].padEnd(40)} ${amt.toFixed(2)} USD`);
    }
    console.log(`  ${'TOTAL'.padEnd(40)} ${total.toFixed(2)} USD   (Cost Explorer tarda hasta 24 h en reflejar el uso)`);
  }
} catch (e) {
  console.log('\nCost Explorer no disponible para este rol o aún sin datos:', e.message.split('\n')[0]);
}
console.log();
