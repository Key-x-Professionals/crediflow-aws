# Sesión 6 · Laboratorio: asegurar, observar y operar CrediFlow

**Duración:** 110 min · **Entregable:** cdk-nag sin errores, WAF (y GuardDuty/CloudTrail a nivel de cuenta) activos, dashboard y alarmas, runbook, postmortem del simulacro y **demo final**.

**Punto de partida:** `git checkout a06-inicio`. Tarea previa: [guía de observabilidad](../guia-observabilidad.md). Al llegar: `npm run encender` (~6 min).

> **Costo.** El WAF cuesta 5 USD/mes por WebACL **prorrateado por hora** (~0.02 USD por la sesión); el dashboard 3 USD/mes y las alarmas 0.10 USD/mes cada una **se cobran por mes**, así que el `npm run apagar` final de hoy importa más que nunca.

---

## Parte A · cdk-nag: la revisión automática (15 min)

```bash
cd infra && npm run nag 2>&1 | grep -E "ERROR|WARNING" | sort | uniq -c
```
```powershell
cd infra; npm run nag 2>&1 | Select-String "ERROR|WARNING" | Group-Object | Select-Object Count, Name
```

Verás ~10 hallazgos `AwsSolutions-*`. Con el **prompt 6.1**, clasifica cada uno en:

- **Corregir**: por ejemplo `COG1` (política de contraseñas débil) → en `ServerlessStack` exige símbolos y minúsculas.
- **Reconocer con justificación**: por ejemplo `DDB3` (point-in-time recovery solo en prod por costo) → `NagSuppressions.addStackSuppressions(data, [{ id: 'AwsSolutions-DDB3', reason: '...' }])` en `bin/crediflow.ts`; o `EC23` (el ALB y las tareas son públicos por diseño sin NAT).

Regla del equipo: **ninguna supresión sin un `reason` que un auditor acepte**. Repite hasta que `npm run nag` termine sin `ERROR`. Las supresiones se revisan en el PR.

✅ **Checkpoint A:** `Successfully synthesized` con `CF_NAG=true`.

---

## Parte B · SecurityStack: WAF y detección (20 min)

Completa `infra/lib/stacks/security-stack.ts`: WebACL regional con `AWSManagedRulesCommonRuleSet`, `KnownBadInputs`, `AmazonIpReputationList` y una regla de **rate limit** (500 req / 5 min por IP); asociación al ALB y a la etapa de API Gateway; logs en `aws-waf-logs-*`.

> GuardDuty y CloudTrail son **uno por cuenta/región**. Los despliega el instructor con `CF_ACCOUNT_SECURITY=true`. Tú solo verificas que existen.

```bash
npx cdk deploy Security
```

### B1. Probar el WAF

```bash
export API_URL=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/api-url --query Parameter.Value --output text)
# Entrada maliciosa típica → 403 por el Common Rule Set
curl -s -o /dev/null -w "%{http_code}\n" "$API_URL/solicitudes?q=<script>alert(1)</script>"
curl -s -o /dev/null -w "%{http_code}\n" "$API_URL/solicitudes" -H "User-Agent: sqlmap/1.0"
# Rate limit: 600 peticiones rápidas → a partir de ~500, 403 (tarda 1-2 min en aplicar)
for i in $(seq 1 600); do curl -s -o /dev/null -w "%{http_code} " $API_URL/health; done
```
```powershell
$env:API_URL = aws ssm get-parameter --name "/crediflow/$env:CF_STUDENT/dev/api-url" --query Parameter.Value --output text
(Invoke-WebRequest "$env:API_URL/solicitudes?q=<script>alert(1)</script>" -UseBasicParsing -SkipHttpErrorCheck).StatusCode
1..600 | ForEach-Object { (Invoke-WebRequest "$env:API_URL/health" -UseBasicParsing -SkipHttpErrorCheck).StatusCode }
```

Consola: WAF & Shield → Web ACLs → tu ACL → **Sampled requests** y gráfica por regla. Logs:

```bash
aws logs tail aws-waf-logs-crediflow-$CF_STUDENT-dev --since 10m --format short | head -20
```

### B2. ¿Quién hizo qué? CloudTrail

```bash
aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity --max-results 5 \
  --query 'Events[].[EventTime,Username,CloudTrailEvent]' --output text | head -5
aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=StopTask --max-results 3 --query 'Events[].[EventTime,Username]'
```

Ahí está tu `stop-task` de la sesión 4 y los despliegues del pipeline por OIDC: **trazabilidad completa**.

### B3. GuardDuty (demostración del instructor)

```bash
aws guardduty list-detectors
aws guardduty list-findings --detector-id <id> --max-results 5
```

El instructor genera hallazgos de muestra (`create-sample-findings`) para ver cómo se ve una alerta de credenciales expuestas o de minería de criptomonedas.

✅ **Checkpoint B:** 403 del WAF por contenido malicioso y por tasa; evento de CloudTrail de tu propio `stop-task`.

---

## 🔁 Receso (10 min)

---

## Parte C · ObservabilityStack: señales doradas (20 min)

Completa `infra/lib/stacks/observability-stack.ts` siguiendo los `TODO`: topic de alertas con tu correo, métricas (ALB, target group, ECS, API Gateway, Lambda, SQS, negocio en namespace `CrediFlow`), 6 alarmas y el dashboard de 4 filas.

```bash
npx cdk deploy Observability
aws cloudformation describe-stacks --stack-name CrediFlow-$CF_STUDENT-dev-Observability --query "Stacks[0].Outputs[?OutputKey=='DashboardUrl'].OutputValue" --output text
```

Confirma la suscripción de correo del topic `topic-alertas`. Abre el dashboard. Genera tráfico (`node scripts/load/carga.js $API_URL 60 10`) y crea solicitudes para que las métricas de negocio aparezcan.

### C1. Logs Insights

CloudWatch → Logs Insights → grupo `/crediflow/<alumno>/dev/api`:

```
fields @timestamp, method, path, status, durationMs
| filter status >= 500
| sort @timestamp desc
| limit 20
```

```
stats avg(durationMs), pct(durationMs, 95) as p95, count(*) as n by path
| sort n desc
```

Grupo `/crediflow/<alumno>/dev/fn-evaluador` (logs de Powertools):

```
fields @timestamp, message, solicitudId, resultado, score
| filter message = "Solicitud evaluada"
| stats count(*) by resultado
```

Pide a Claude 2 consultas más con el **prompt 6.2** (en lenguaje natural → Logs Insights).

### C2. Trazas

X-Ray → **Service map**: API Gateway → Lambda → DynamoDB; y el worker → DynamoDB / EventBridge. Abre una traza lenta y encuentra el segmento más caro.

✅ **Checkpoint C:** dashboard con datos, 6 alarmas en `OK`, consultas de Logs Insights guardadas.

---

## Parte D · Simulacro de incidente (25 min, por equipos)

**Reglas del juego.** El instructor inyecta **una falla** en el entorno de cada equipo sin decir cuál. El equipo debe: (1) detectar por alarma o dashboard, (2) diagnosticar con el runbook, (3) mitigar, (4) corregir **en código** si aplica, (5) escribir el postmortem. Tiempo objetivo: 20 min. Se vale usar Claude como asistente de diagnóstico (**prompt 6.3**), no como oráculo.

Posibles fallas (el instructor elige): worker con `FAILURE_RATE=0.8`; `FAIL_HEALTH=true` en una revisión nueva; permiso `dynamodb:UpdateItem` quitado al rol del worker; `desiredCount` forzado a 0; cuota de concurrencia de la Lambda en 0; borrado del parámetro SSM `api-url`.

Runbooks de referencia: `docs/plantillas/runbook.md` (RB-01 API degradada, RB-02 evaluación atascada, RB-03 precalificación caída). Copia la plantilla a `docs/sesion-06/runbook-<equipo>.md` y complétala con **tus** comandos y nombres.

Comandos útiles durante el simulacro:

```bash
aws cloudwatch describe-alarms --state-value ALARM --query 'MetricAlarms[].[AlarmName,StateReason]' --output table
aws ecs describe-services --cluster crediflow-$CF_STUDENT-dev-api-cluster --services crediflow-$CF_STUDENT-dev-api --query 'services[0].[desiredCount,runningCount,events[0].message]'
aws lambda get-function-configuration --function-name crediflow-$CF_STUDENT-dev-fn-evaluador --query '[Environment.Variables,ReservedConcurrentExecutions]'
aws sqs get-queue-attributes --queue-url $(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/queue-url --query Parameter.Value --output text) --attribute-names All --query 'Attributes.[ApproximateNumberOfMessages,ApproximateNumberOfMessagesNotVisible]'
aws logs tail /crediflow/$CF_STUDENT/dev/fn-evaluador --since 10m --format short | grep -i error
cd infra && npx cdk diff            # ¡la deriva! lo que cambiaron a mano vs tu código
```

**Lección clave:** la mitigación puede ser manual (restaurar la variable), pero la corrección definitiva es `cdk deploy` desde el código, que elimina la deriva. Discute: ¿qué habría detectado antes el problema?

Al terminar: `docs/sesion-06/postmortem-<equipo>.md` desde la plantilla, con Claude como redactor del borrador (**prompt 6.4**) y el equipo como editor.

---

## Parte E · Demo final (15 min, 4 min por equipo)

Cada equipo muestra, en vivo y por turnos (**cada integrante presenta una parte**):

1. Una solicitud desde el frontend hasta el correo de notificación (flujo completo).
2. Precalificación con login.
3. El dashboard con tráfico real y una alarma.
4. Una pregunta del instructor sobre cualquier parte del código (regla 5 de uso de IA).

Se evalúa con la [rúbrica](../../README.md) (100 puntos): IaC 20 · Automatización 10 · Escalabilidad 20 · Serverless y eventos 20 · Seguridad 15 · Monitoreo y operación 15.

---

## Cierre (5 min)

1. [Checklist](checklist.md) y entrega de `runbook`, `postmortem` y PR final con las supresiones de cdk-nag.
2. **Limpieza**: `npm run apagar` hoy mismo (dashboard y alarmas se cobran por mes) y ver [limpieza.md](../00-preparacion/limpieza.md) para el resto (lab 1, repos).
3. Constancia: asistencia ≥ 5/6 y nota final ≥ 70.
