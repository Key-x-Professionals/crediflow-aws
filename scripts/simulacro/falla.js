#!/usr/bin/env node
/**
 * Simulacro de incidente (sesión 6) · herramienta del INSTRUCTOR.
 *
 *   node scripts/simulacro/falla.js <alumno> 1         evaluador con fallas (FAILURE_RATE = 0.8)
 *   node scripts/simulacro/falla.js <alumno> 2         evaluador detenido (concurrencia reservada = 0)
 *   node scripts/simulacro/falla.js <alumno> 3         API aislada (se quita la regla balanceador -> tareas)
 *   node scripts/simulacro/falla.js <alumno> estado    muestra los tres puntos que tocan las fallas
 *   node scripts/simulacro/falla.js <alumno> reparar   deja todo como lo declara el código
 *
 * Inyecta UNA falla a mano (fuera del código) en el entorno dev de un alumno, para que su equipo la
 * detecte, la diagnostique y la corrija. Usa la AWS CLI con tu sesión; no necesita dependencias.
 * Ensaya las tres con tu usuario de prueba antes de la clase.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [alumno, accion] = process.argv.slice(2);
if (!alumno || !accion) {
  console.error('Uso: node scripts/simulacro/falla.js <alumno> <1|2|3|estado|reparar>');
  process.exit(1);
}
const prefijo = `crediflow-${alumno}-dev`;
const fn = `${prefijo}-fn-evaluador`;
const cluster = `${prefijo}-api-cluster`;
const servicio = `${prefijo}-api`;
const archivoEstado = path.join(__dirname, `.estado-${alumno}.json`);

function aws(...args) {
  const out = execFileSync('aws', [...args, '--output', 'json'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, AWS_PAGER: '' } }).toString();
  return out.trim() ? JSON.parse(out) : {};
}

function variables() {
  return aws('lambda', 'get-function-configuration', '--function-name', fn).Environment?.Variables ?? {};
}
function fijarFailureRate(valor) {
  const vars = { ...variables(), FAILURE_RATE: valor };
  aws('lambda', 'update-function-configuration', '--function-name', fn, '--environment', JSON.stringify({ Variables: vars }));
}
function grupoDeLasTareas() {
  const s = aws('ecs', 'describe-services', '--cluster', cluster, '--services', servicio).services?.[0];
  if (!s) throw new Error(`No encuentro el servicio ${servicio}: ¿el alumno tiene todo encendido?`);
  return s.networkConfiguration.awsvpcConfiguration.securityGroups[0];
}
function reglasDesdeElBalanceador(sg) {
  const reglas = aws('ec2', 'describe-security-group-rules', '--filters', `Name=group-id,Values=${sg}`).SecurityGroupRules ?? [];
  return reglas.filter((r) => !r.IsEgress && r.ReferencedGroupInfo?.GroupId);
}

try {
  if (accion === '1') {
    fijarFailureRate('0.8');
    console.log(`Falla 1 inyectada en ${alumno}: el evaluador falla 8 de cada 10 veces.`);
    console.log('Se nota en: alarm-lambda-errores (1-2 min con tráfico), solicitudes que tardan, alarm-dlq (unos 9 min).');
  } else if (accion === '2') {
    aws('lambda', 'put-function-concurrency', '--function-name', fn, '--reserved-concurrent-executions', '0');
    console.log(`Falla 2 inyectada en ${alumno}: el evaluador no puede ejecutarse (concurrencia 0).`);
    console.log('Se nota en: solicitudes que se quedan EN_EVALUACION, la cola crece, alarm-cola-antiguedad (6-8 min). No hay errores en los registros.');
  } else if (accion === '3') {
    const sg = grupoDeLasTareas();
    const reglas = reglasDesdeElBalanceador(sg);
    if (reglas.length === 0) throw new Error('No hay regla que quitar: ¿ya estaba inyectada?');
    fs.writeFileSync(archivoEstado, JSON.stringify({ sg, reglas }, null, 2));
    aws('ec2', 'revoke-security-group-ingress', '--group-id', sg, '--security-group-rule-ids', ...reglas.map((r) => r.SecurityGroupRuleId));
    console.log(`Falla 3 inyectada en ${alumno}: el balanceador ya no puede llegar a las tareas (grupo ${sg}).`);
    console.log('Se nota en: /health deja de responder (503/504) en 1 minuto, alarm-api-hosts y alarm-api-5xx (2-3 min).');
    console.log(`Regla guardada en ${archivoEstado} para "reparar".`);
  } else if (accion === 'estado') {
    const cfg = aws('lambda', 'get-function-configuration', '--function-name', fn);
    let conc = 'sin límite';
    try {
      const c = aws('lambda', 'get-function-concurrency', '--function-name', fn);
      if (c.ReservedConcurrentExecutions !== undefined) conc = String(c.ReservedConcurrentExecutions);
    } catch { /* sin concurrencia reservada */ }
    const sg = grupoDeLasTareas();
    console.log(`FAILURE_RATE del evaluador:      ${cfg.Environment?.Variables?.FAILURE_RATE}   (el código dice 0)`);
    console.log(`Concurrencia reservada:          ${conc}   (el código no la limita)`);
    console.log(`Reglas balanceador -> tareas:    ${reglasDesdeElBalanceador(sg).length}   (el código declara 1)`);
  } else if (accion === 'reparar') {
    fijarFailureRate('0');
    try { aws('lambda', 'delete-function-concurrency', '--function-name', fn); } catch { /* no había */ }
    if (fs.existsSync(archivoEstado)) {
      const { sg, reglas } = JSON.parse(fs.readFileSync(archivoEstado, 'utf8'));
      if (reglasDesdeElBalanceador(sg).length === 0) {
        const permisos = reglas.map((r) => ({
          IpProtocol: r.IpProtocol, FromPort: r.FromPort, ToPort: r.ToPort,
          UserIdGroupPairs: [{ GroupId: r.ReferencedGroupInfo.GroupId, Description: r.Description ?? 'Balanceador hacia las tareas' }],
        }));
        aws('ec2', 'authorize-security-group-ingress', '--group-id', sg, '--ip-permissions', JSON.stringify(permisos));
      }
      fs.unlinkSync(archivoEstado);
    }
    console.log(`Entorno de ${alumno} reparado: FAILURE_RATE=0, sin límite de concurrencia y regla del balanceador en su sitio.`);
  } else {
    console.error(`Acción desconocida: ${accion}`);
    process.exit(1);
  }
} catch (err) {
  console.error(`No se pudo completar: ${err.stderr?.toString().trim() || err.message}`);
  process.exit(1);
}
