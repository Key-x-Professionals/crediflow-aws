# Runbook de operación · CrediFlow · Equipo ______

> Un runbook se escribe para alguien que **no conoce el sistema** y lo lee a las 3 a.m. Cada paso tiene un comando y un resultado esperado.

## Datos generales

| | |
|---|---|
| Sistema | CrediFlow (`CF_STUDENT=____`, `CF_ENV=dev`) |
| Dueño / guardia | |
| Canal de escalamiento | |
| Dashboard | `crediflow-<alumno>-dev-dashboard` |
| Severidades | S1: no se reciben solicitudes · S2: se reciben pero no se evalúan · S3: precalificación caída · S4: degradación sin impacto |

---

## RB-01 · API degradada o caída (alarmas `alarm-api-5xx`, `alarm-api-latencia`, `alarm-api-hosts`)

**Severidad:** S1 · **Síntoma:** errores 5xx, latencia > 1 s o menos de 2 tareas sanas.

1. Confirmar el impacto desde fuera:
   `curl -s -o /dev/null -w "%{http_code}" $API_URL/health` → esperado `200`. `403` = el WAF te bloquea (¿límite de tasa?); `502/503/504` = el balanceador no consigue respuesta de las tareas; `503` con JSON de la API = la tarea responde pero no llega a la tabla.
2. Estado del servicio:
   `aws ecs describe-services --cluster <c> --services <s> --query 'services[0].[desiredCount,runningCount,deployments[].rolloutState,events[0:4].message]'`
   - `runningCount < desiredCount` → ver por qué se detienen las tareas: `aws ecs list-tasks --cluster <c> --desired-status STOPPED` y `describe-tasks ... --query 'tasks[].stoppedReason'`.
   - `rolloutState: FAILED` → despliegue roto; el *circuit breaker* ya volvió a la versión anterior. Revisar el último cambio en Git.
   - Los eventos dicen que las tareas "fallan los health checks del balanceador" una y otra vez, pero los registros de la API son normales → el balanceador **no puede llegar** a las tareas: paso 3.
3. ¿El balanceador puede hablar con las tareas?
   `aws elbv2 describe-target-health --target-group-arn <tg> --query 'TargetHealthDescriptions[].TargetHealth'` → `Target.Timeout` apunta a la red.
   Grupo de seguridad de las tareas: `aws ecs describe-services ... --query 'services[0].networkConfiguration.awsvpcConfiguration.securityGroups[0]'` y
   `aws ec2 describe-security-group-rules --filters Name=group-id,Values=<sg-tareas> --query 'SecurityGroupRules[?!IsEgress]'`.
   Debe existir **una regla de entrada, puerto 3000, cuyo origen es el grupo del balanceador**. Si falta → **Mitigar:** `aws ec2 authorize-security-group-ingress --group-id <sg-tareas> --protocol tcp --port 3000 --source-group <sg-balanceador>`.
4. Base de datos (DynamoDB):
   `aws dynamodb describe-table --table-name <tabla> --query 'Table.TableStatus'` → `ACTIVE`.
   `/health` con `"database":"unavailable"` y la tabla activa = la tarea no tiene permiso: revisar la política del rol de la tarea.
5. Registros de la API (últimos errores):
   `aws logs tail /crediflow/<alumno>/dev/api --since 15m --format short`
6. Verificar la recuperación: `/health` → 200 durante 2 minutos; dos destinos `healthy`; alarmas en `OK`.
7. Si no se resuelve en 15 minutos → escalar a ______.

---

## RB-02 · Evaluaciones atascadas (alarmas `alarm-dlq`, `alarm-cola-antiguedad`, `alarm-lambda-errores`)

**Severidad:** S2 · **Síntoma:** las solicitudes se quedan en `EN_EVALUACION`; la cola crece; mensajes en la cola de errores.

1. Profundidad de la cola y de la cola de errores:
   `aws sqs get-queue-attributes --queue-url $QUEUE_URL --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible`
   `aws sqs get-queue-attributes --queue-url $DLQ_URL --attribute-names ApproximateNumberOfMessages`
2. ¿El evaluador se está ejecutando? ¿Con errores, o no se ejecuta?
   `aws logs tail /crediflow/<alumno>/dev/fn-evaluador --since 15m --format short`
   - **Hay errores** → leer el mensaje:
     - "Falla simulada…" o un error que no depende del mensaje → revisar la configuración: `aws lambda get-function-configuration --function-name <fn> --query 'Environment.Variables'`. `FAILURE_RATE` distinto de `0` = cambio manual. **Mitigar:** devolverlo a `0` (consola de Lambda → Configuration → Environment variables; por CLI hay que enviar **todas** las variables).
     - `AccessDeniedException` → al rol del evaluador le falta un permiso: comparar con el código (`events-stack.ts`).
     - `ConditionalCheckFailedException` → el mensaje apunta a una solicitud que no existe: mensaje envenenado; irá a la cola de errores.
   - **No hay ni una línea reciente** y la cola crece → el evaluador no se ejecuta:
     `aws lambda get-function-concurrency --function-name <fn>` → si responde `ReservedConcurrentExecutions: 0`, alguien lo detuvo. **Mitigar:** `aws lambda delete-function-concurrency --function-name <fn>`.
     `aws lambda list-event-source-mappings --function-name <fn> --query 'EventSourceMappings[].State'` → debe decir `Enabled`.
3. Inspeccionar un mensaje de la cola de errores **sin borrarlo**:
   `aws sqs receive-message --queue-url $DLQ_URL --visibility-timeout 5 --max-number-of-messages 1`
   - Mensaje mal formado → purgar; anotar en el postmortem quién lo envió (CloudTrail, `SendMessage`).
   - Mensaje válido que falló por una causa ya corregida → **reprocesar**: `aws sqs start-message-move-task --source-arn <arn de la cola de errores>`.
4. Verificar: la solicitud afectada pasa a `APROBADA` o `RECHAZADA` (`curl $API_URL/solicitudes/<id>`); cola de errores en 0; alarmas en `OK`.

---

## RB-03 · Precalificación caída (API Gateway 5xx / 403 masivos)

**Severidad:** S3.

1. `curl -s ${PRECAL_URL}health` → 200 esperado. 403 en todas las rutas → revisar WAF (regla de rate limit o IP reputación): `aws wafv2 get-sampled-requests ...` o consola → Sampled requests.
2. Errores de la Lambda: `aws logs tail /crediflow/<alumno>/dev/fn-precalificar --since 15m --format short`.
3. 401 masivos → tokens expirados o cambio en el User Pool: `aws cognito-idp describe-user-pool-client ...`.
4. Verificar con un token nuevo (ver guía de la sesión 5, A3/A4).

---

## Después de cualquier incidente

- [ ] Alarmas en `OK` y tablero normal durante 15 minutos
- [ ] **¿Qué cambió, y quién?** `aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventSource,AttributeValue=<servicio>.amazonaws.com --max-results 20 --query 'Events[].[EventTime,EventName,Username]' --output table` (los eventos tardan hasta 15 minutos)
- [ ] **¿La cuenta coincide con el código?** `npx cdk drift <Stack>` (o CloudFormation → el stack → *Detect drift*). Ojo: `cdk diff` no sirve para esto, la detección de deriva solo revisa las propiedades que el código declara, y volver a desplegar no corrige un cambio manual si el código no cambió
- [ ] Lo que se cambió a mano para mitigar quedó como dice el código, o el código se cambió por pull request
- [ ] Postmortem iniciado (plantilla) en menos de 24 horas
