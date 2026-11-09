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

1. Confirmar impacto desde fuera:
   `curl -s -o /dev/null -w "%{http_code}" $API_URL/health` → esperado `200`; `503` = base de datos; sin respuesta = ALB/tareas.
2. Estado del servicio:
   `aws ecs describe-services --cluster <c> --services <s> --query 'services[0].[desiredCount,runningCount,deployments[].rolloutState,events[0:3].message]'`
   - `runningCount < desiredCount` → ver tareas detenidas: `aws ecs list-tasks --cluster <c> --desired-status STOPPED` y `describe-tasks ... --query 'tasks[].stoppedReason'`.
   - `rolloutState: FAILED/ROLLBACK` → despliegue roto; el circuit breaker ya revirtió. Revisar el último cambio en Git.
   - `desiredCount: 0` → alguien lo cambió a mano. **Mitigar:** `cdk deploy Service` restaura el valor del código.
3. Base de datos (DynamoDB):
   `aws dynamodb describe-table --table-name <tabla> --query 'Table.TableStatus'` → `ACTIVE`.
   `/health` en `degraded` con la tabla activa = la tarea no puede leerla: revisa la política del rol de la tarea (`aws iam list-role-policies --role-name <rol>`), que alguien pudo haber recortado a mano.
   Si falta → **deriva**: `cdk diff Service` la muestra; `cdk deploy Service` la corrige.
4. Logs de la API (últimos errores):
   `aws logs tail /crediflow/<alumno>/dev/api --since 15m --format short | grep '"level":"error"'`
5. Verificar recuperación: `/health` → 200 durante 2 min; alarmas vuelven a `OK`.
6. Si no se resuelve en 15 min → escalar a ______.

---

## RB-02 · Evaluaciones atascadas (alarmas `alarm-dlq`, `alarm-cola-antiguedad`, `alarm-lambda-errores`)

**Severidad:** S2 · **Síntoma:** solicitudes se quedan en `EN_EVALUACION`; mensajes en la DLQ.

1. Profundidad de la cola y DLQ:
   `aws sqs get-queue-attributes --queue-url $QUEUE_URL --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible`
   `aws sqs get-queue-attributes --queue-url $DLQ_URL --attribute-names ApproximateNumberOfMessages`
2. ¿El worker está fallando?
   `aws logs tail /crediflow/<alumno>/dev/fn-evaluador --since 15m --format short | grep -iE "error|falla"`
   `aws lambda get-function-configuration --function-name <fn> --query '[Environment.Variables.FAILURE_RATE,ReservedConcurrentExecutions,State]'`
   - `FAILURE_RATE != 0` o `ReservedConcurrentExecutions: 0` → cambio manual. **Mitigar:** `cdk deploy Events`.
   - `AccessDeniedException` sobre DynamoDB en los logs → al rol del worker le falta `dynamodb:UpdateItem`: deriva; `cdk deploy Events` la corrige.
   - `ConditionalCheckFailedException` → el mensaje trae un `solicitudId` que no existe en la tabla: mensaje envenenado, va a la DLQ.
3. Inspeccionar un mensaje de la DLQ **sin borrarlo**:
   `aws sqs receive-message --queue-url $DLQ_URL --visibility-timeout 0 --max-number-of-messages 1`
   - Mensaje malformado → purgar solo ese tipo; registrar en el postmortem quién lo envió (CloudTrail `SendMessage`).
   - Mensaje válido que falló por causa ya corregida → **reprocesar**: `aws sqs start-message-move-task --source-arn <dlq-arn>`.
4. Verificar: la solicitud afectada pasa a `APROBADA/RECHAZADA` (`curl $API_URL/solicitudes/<id>`); DLQ en 0; alarmas `OK`.

---

## RB-03 · Precalificación caída (API Gateway 5xx / 403 masivos)

**Severidad:** S3.

1. `curl -s ${PRECAL_URL}health` → 200 esperado. 403 en todas las rutas → revisar WAF (regla de rate limit o IP reputación): `aws wafv2 get-sampled-requests ...` o consola → Sampled requests.
2. Errores de la Lambda: `aws logs tail /crediflow/<alumno>/dev/fn-precalificar --since 15m --format short`.
3. 401 masivos → tokens expirados o cambio en el User Pool: `aws cognito-idp describe-user-pool-client ...`.
4. Verificar con un token nuevo (ver guía de la sesión 5, A3/A4).

---

## Después de cualquier incidente

- [ ] Alarmas en `OK` y dashboard normal durante 15 min
- [ ] `cdk diff --all` sin diferencias (sin deriva)
- [ ] Postmortem iniciado (plantilla) en menos de 24 h
