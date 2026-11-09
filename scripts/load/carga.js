#!/usr/bin/env node
/**
 * Prueba de carga sencilla (sesión 4): dispara N solicitudes concurrentes contra la API.
 *
 *   node scripts/load/carga.js http://<alb-dns> 60 20
 *                              URL             segundos  concurrencia
 */
const url = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const seconds = Number(process.argv[3] ?? 60);
const concurrency = Number(process.argv[4] ?? 20);

const body = () => ({
  nombre: `Carga ${Math.random().toString(36).slice(2, 8)}`,
  documento: `${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}-${Math.floor(Math.random() * 10)}`,
  monto: 1000 + Math.floor(Math.random() * 20000),
  plazoMeses: [12, 24, 36, 48][Math.floor(Math.random() * 4)],
  ingresoMensual: 500 + Math.floor(Math.random() * 3000),
  proposito: ['consumo', 'vivienda', 'vehiculo', 'negocio', 'educacion'][Math.floor(Math.random() * 5)],
});

const stats = { ok: 0, err: 0, latencias: [] };
const end = Date.now() + seconds * 1000;

async function worker() {
  while (Date.now() < end) {
    const t = Date.now();
    try {
      const r = await fetch(`${url}/solicitudes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body()),
      });
      r.ok ? stats.ok++ : stats.err++;
    } catch {
      stats.err++;
    }
    stats.latencias.push(Date.now() - t);
  }
}

console.log(`Carga contra ${url} durante ${seconds}s con ${concurrency} workers...`);
const timer = setInterval(() => {
  const total = stats.ok + stats.err;
  process.stdout.write(`\r  ok=${stats.ok} err=${stats.err} rps≈${(total / ((seconds * 1000 - (end - Date.now())) / 1000)).toFixed(1)}   `);
}, 1000);

Promise.all(Array.from({ length: concurrency }, worker)).then(() => {
  clearInterval(timer);
  const l = stats.latencias.sort((a, b) => a - b);
  const p = (q) => l[Math.floor(l.length * q)] ?? 0;
  console.log(`\n\nResultado: ${stats.ok} ok, ${stats.err} errores, ${l.length} solicitudes`);
  console.log(`Latencia p50=${p(0.5)}ms p95=${p(0.95)}ms p99=${p(0.99)}ms`);
});
