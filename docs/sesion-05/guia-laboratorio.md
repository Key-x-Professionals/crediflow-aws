# Sesión 5 · Laboratorio: precalificación serverless y evaluación asíncrona con colas y eventos

**Duración:** 110 min · **Entregable:** `ServerlessStack` y `EventsStack` desplegados; autenticación, idempotencia y DLQ probadas; el flujo completo de CrediFlow funcionando de punta a punta en el frontend.

**Punto de partida:** `git checkout a05-inicio`. Al llegar: `npm run encender` (el ALB y las tareas tardan ~5 min).

```
API Gateway ──(JWT Cognito)──► Lambda precalificar ──► DynamoDB (precalificaciones)
API (ECS) ──► SQS evaluaciones ──► Lambda evaluador ──► DynamoDB (solicitudes) + EventBridge ──► SNS (correo) + Lambda notificador
                  └── DLQ (3 reintentos) ──► alarma
```

---

## Parte A · ServerlessStack: API de precalificación (25 min)

### A1. Leer antes de escribir

- `apps/precalificacion/src/motor.ts`: la regla de negocio (DTI ≤ 40 %). Corre sus pruebas: `npm test -w apps/precalificacion`.
- `apps/precalificacion/src/precalificar.ts`: handler con Powertools (logger, métricas, tracer) y escritura en DynamoDB con claves `pk = USER#<sub>`, `sk = PRECAL#<fecha>#<id>`. Usa el **prompt 5.2** para discutir el diseño de claves.
- `constructs/crediflow-function.ts` y `constructs/crediflow-rest-api.ts`: lo que cada Lambda y API traen de serie.

### A2. Completar el stack

En `infra/lib/stacks/serverless-stack.ts`, siguiendo los `TODO`: User Pool + cliente, tabla, tres funciones (`precalificar`, `consultar`, `health`), la API con autorizador Cognito y las rutas:

```ts
this.api.addRoute('health', 'GET', healthFn.fn);
this.api.addRoute('precalificar', 'POST', this.precalificarFn.fn, { auth: true });
this.api.addRoute('precalificaciones', 'GET', consultarFn.fn, { auth: true });
```

y los permisos mínimos: `grantWriteData` para precalificar, `grantReadData` para consultar.

```bash
cd infra && npm test && npx cdk deploy Serverless     # ~3 min
```

### A3. Usuario de prueba y token (CLI)

```bash
# Mac
export POOL_ID=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/user-pool-id --query Parameter.Value --output text)
export CLIENT_ID=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/user-pool-client-id --query Parameter.Value --output text)
export PRECAL_URL=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/precal-url --query Parameter.Value --output text)
aws cognito-idp admin-create-user --user-pool-id $POOL_ID --username ana@ejemplo.com --user-attributes Name=email,Value=ana@ejemplo.com Name=email_verified,Value=true --message-action SUPPRESS
aws cognito-idp admin-set-user-password --user-pool-id $POOL_ID --username ana@ejemplo.com --password 'CrediFlow#2026' --permanent
export TOKEN=$(aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id $CLIENT_ID \
  --auth-parameters USERNAME=ana@ejemplo.com,PASSWORD='CrediFlow#2026' --query AuthenticationResult.IdToken --output text)
```
```powershell
# Windows
$env:POOL_ID = aws ssm get-parameter --name "/crediflow/$env:CF_STUDENT/dev/user-pool-id" --query Parameter.Value --output text
$env:CLIENT_ID = aws ssm get-parameter --name "/crediflow/$env:CF_STUDENT/dev/user-pool-client-id" --query Parameter.Value --output text
$env:PRECAL_URL = aws ssm get-parameter --name "/crediflow/$env:CF_STUDENT/dev/precal-url" --query Parameter.Value --output text
aws cognito-idp admin-create-user --user-pool-id $env:POOL_ID --username ana@ejemplo.com --user-attributes Name=email,Value=ana@ejemplo.com Name=email_verified,Value=true --message-action SUPPRESS
aws cognito-idp admin-set-user-password --user-pool-id $env:POOL_ID --username ana@ejemplo.com --password 'CrediFlow#2026' --permanent
$env:TOKEN = aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id $env:CLIENT_ID --auth-parameters "USERNAME=ana@ejemplo.com,PASSWORD=CrediFlow#2026" --query AuthenticationResult.IdToken --output text
```

### A4. Probar: sin token 401, con token 200

```bash
curl -s ${PRECAL_URL}health
curl -s -X POST ${PRECAL_URL}precalificar -H "Content-Type: application/json" -d '{"ingresoMensual":1500,"deudasMensuales":200,"montoSolicitado":8000,"plazoMeses":36}'      # 401
curl -s -X POST ${PRECAL_URL}precalificar -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"ingresoMensual":1500,"deudasMensuales":200,"montoSolicitado":8000,"plazoMeses":36}'                                                     # 200
curl -s ${PRECAL_URL}precalificaciones -H "Authorization: Bearer $TOKEN"
```
```powershell
Invoke-RestMethod "$($env:PRECAL_URL)health"
try { Invoke-RestMethod -Method Post -Uri "$($env:PRECAL_URL)precalificar" -ContentType application/json -Body '{"ingresoMensual":1500,"deudasMensuales":200,"montoSolicitado":8000,"plazoMeses":36}' } catch { $_.Exception.Response.StatusCode }
Invoke-RestMethod -Method Post -Uri "$($env:PRECAL_URL)precalificar" -ContentType application/json -Headers @{ Authorization = "Bearer $env:TOKEN" } -Body '{"ingresoMensual":1500,"deudasMensuales":200,"montoSolicitado":8000,"plazoMeses":36}'
Invoke-RestMethod "$($env:PRECAL_URL)precalificaciones" -Headers @{ Authorization = "Bearer $env:TOKEN" }
```

Pega el JWT en <https://jwt.io> (es un token de prueba): mira `sub`, `email`, `exp`, `iss`. Eso es lo que API Gateway valida **antes** de invocar la Lambda.

Verifica en consola: Cognito → User pools → usuario; API Gateway → *Stages → v1 → Logs*; Lambda → `fn-precalificar` → **Monitor → Traces** (X-Ray); DynamoDB → *Explore items*.

```bash
aws logs tail /crediflow/$CF_STUDENT/dev/fn-precalificar --since 10m --format short
aws dynamodb scan --table-name crediflow-$CF_STUDENT-dev-tbl-precalificaciones --max-items 3 --query 'Items[].[pk.S,sk.S,elegible.BOOL]'
```

✅ **Checkpoint A:** 401 sin token, 200 con token, ítem en DynamoDB, traza en X-Ray.

---

## Parte B · EventsStack: cola, worker, bus y notificaciones (25 min)

Completa `infra/lib/stacks/events-stack.ts` con los `TODO`: `CrediFlowQueue`, tabla de idempotencia (TTL `expiresAt`), `EventBus`, worker **fuera de la VPC** con `grantReadWriteData` sobre la tabla de solicitudes (no hay secretos ni NAT: el worker habla con DynamoDB por la API pública con TLS), `SqsEventSource` con `reportBatchItemFailures`, dos reglas (todas las evaluadas → SNS + notificador; rechazos ≥ 20,000 → notificador) y `AlertTopic` con tu correo.

Lee `apps/worker/src/evaluador.ts` con el **prompt 5.4** (idempotencia): ¿qué pasa si el worker falla **después** de actualizar la tabla pero **antes** de publicar el evento?

```bash
npx cdk deploy Events        # ~3 min
```

**Confirma la suscripción** del correo que llega de SNS (si no, no recibirás notificaciones).

### B1. Conectar la API a la cola

En `infra/bin/crediflow.ts` pasa `queue: events.queue.queue` a `ServiceStack` (y agrega la prop opcional `queue?: sqs.IQueue` en `service-stack.ts` con `QUEUE_URL` en `environment` y `props.queue?.grantSendMessages(...)`). Es un cambio pequeño: la API ya sabe encolar si existe `QUEUE_URL`.

```bash
npx cdk diff Service          # solo cambia la task definition y una política IAM
npx cdk deploy Service        # rolling update ~4 min; mientras: parte C
```

---

## 🔁 Receso (10 min)

---

## Parte C · El flujo completo (15 min)

```bash
export API_URL=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/api-url --query Parameter.Value --output text)
curl -s $API_URL/health                     # queue: "configured"
curl -s -X POST $API_URL/solicitudes -H "Content-Type: application/json" \
  -d '{"nombre":"Ana Pérez","documento":"01234567-8","monto":5000,"plazoMeses":24,"ingresoMensual":1500,"proposito":"vivienda"}'
# estado: EN_EVALUACION. Copia el id y en unos segundos:
curl -s $API_URL/solicitudes/<id>           # estado: APROBADA, resultado.score, cuotaMensual, motivo
```
(Windows: `Invoke-RestMethod` como en sesiones anteriores.)

Sigue el rastro por CLI:

```bash
aws logs tail /crediflow/$CF_STUDENT/dev/fn-evaluador --since 5m --format short      # "Solicitud evaluada"
aws logs tail /crediflow/$CF_STUDENT/dev/fn-notificador --since 5m --format short    # "Notificación enviada"
aws sqs get-queue-attributes --queue-url $(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/queue-url --query Parameter.Value --output text) --attribute-names ApproximateNumberOfMessages
```

Revisa tu correo: "CrediFlow: la solicitud ... fue APROBADA". Crea otra con `monto: 30000, ingresoMensual: 1000` → RECHAZADA y además dispara la regla de alto monto (otro log del notificador con una regla distinta).

Frontend: `./scripts/mac/web-env.sh` (o `.ps1`) → **Estado** con las 4 tarjetas en verde → **Nueva solicitud** → en **Solicitudes** el estado cambia solo de `EN EVALUACION` a `APROBADA`. **Precalificación** → login `ana@ejemplo.com` / `CrediFlow#2026` → calcular.

✅ **Checkpoint C:** una solicitud recorrió API → cola → worker → DynamoDB → EventBridge → correo, y el frontend lo mostró.

---

## Parte D · Probar la idempotencia (10 min)

Envía el **mismo** mensaje dos veces directo a la cola (como si SQS lo entregara duplicado, que es su garantía *at-least-once*):

```bash
QUEUE_URL=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/queue-url --query Parameter.Value --output text)
ID=$(curl -s -X POST $API_URL/solicitudes -H "Content-Type: application/json" -d '{"nombre":"Dup Test","documento":"11111111-1","monto":3000,"plazoMeses":12,"ingresoMensual":2000,"proposito":"consumo"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
MSG="{\"tipo\":\"EvaluarSolicitud\",\"solicitudId\":\"$ID\",\"solicitud\":{\"nombre\":\"Dup Test\",\"monto\":3000,\"plazoMeses\":12,\"ingresoMensual\":2000,\"proposito\":\"consumo\"}}"
aws sqs send-message --queue-url $QUEUE_URL --message-body "$MSG"
aws sqs send-message --queue-url $QUEUE_URL --message-body "$MSG"
sleep 10; aws logs tail /crediflow/$CF_STUDENT/dev/fn-evaluador --since 2m --format short | grep -i "duplicado"
```

Esperado: una evaluación y uno o dos `Mensaje duplicado ignorado (idempotencia)` (la API ya había encolado una vez). En DynamoDB → tabla `tbl-idempotencia` → un ítem con `expiresAt`.

---

## Parte E · Probar la cola de errores (10 min)

Envía un mensaje que el worker no puede procesar:

```bash
aws sqs send-message --queue-url $QUEUE_URL --message-body '{"tipo":"EvaluarSolicitud","solicitudId":"no-es-uuid","solicitud":{"monto":1}}'
```

El worker falla (el `UpdateItem` tiene la condición `attribute_exists(id)` y ese id no existe), SQS reintenta 3 veces (visibility timeout 180 s → tarda unos minutos) y el mensaje pasa a la DLQ. Para no esperar, acelera: envía `'texto que no es JSON'` 3 veces y observa `ErroresEvaluacion` en los logs.

```bash
DLQ_URL=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/dlq-url --query Parameter.Value --output text)
aws sqs get-queue-attributes --queue-url $DLQ_URL --attribute-names ApproximateNumberOfMessages
aws sqs receive-message --queue-url $DLQ_URL --max-number-of-messages 1
aws cloudwatch describe-alarms --alarm-names crediflow-$CF_STUDENT-dev-q-evaluaciones-dlq-messages --query 'MetricAlarms[0].StateValue'
```

Llega el correo de la alarma. Para **reprocesar** (una vez corregida la causa):

```bash
aws sqs start-message-move-task --source-arn $(aws sqs get-queue-attributes --queue-url $DLQ_URL --attribute-names QueueArn --query Attributes.QueueArn --output text)
```

Hoy, como los mensajes son basura, púrgala: `aws sqs purge-queue --queue-url $DLQ_URL`.

---

## Parte F · Desplegar por el pipeline (5 min)

```bash
git checkout -b feat/sesion-5-serverless && git add -A && git commit -m "feat: ServerlessStack y EventsStack" && git push -u origin HEAD && gh pr create --fill
```

Revisión → merge → el pipeline redespliega todo (sin cambios: `No changes`). Es la prueba de que tu código y lo desplegado coinciden.

---

## Cierre (10 min)

1. [Checklist](checklist.md) y **`npm run apagar`** (`npm run costos` para confirmar).
2. **Tarea previa a la sesión 6**: leer la [guía de observabilidad](../guia-observabilidad.md) y dejar listo `CF_ALERT_EMAIL` confirmado.
3. [Reto](reto.md) opcional.
