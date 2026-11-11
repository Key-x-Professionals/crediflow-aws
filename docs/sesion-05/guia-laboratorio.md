# Sesión 5 · Laboratorio: precalificación serverless y evaluación asíncrona con colas y eventos

## Cómo usar esta guía

**Duración:** 100 minutos efectivos más un receso de 10 minutos después del bloque B. **Equipos de 3-4 personas:** cada uno despliega sus propios stacks; el equipo valida el checklist. **Entregable:** `ServerlessStack` y `EventsStack` completos y desplegados; la autenticación, la idempotencia y la cola de errores probadas; una solicitud recorriendo CrediFlow de punta a punta; y **todo apagado antes de salir**.

Convención: los bloques `bash` son para **Mac**; los bloques `powershell` para **Windows (PowerShell 7)**. Si solo hay un bloque, el comando es igual en ambos. Los bloques `ts` son código TypeScript que escribes en VS Code.

Los cinco bloques y su "listo cuando":

| Bloque | Qué haces | Listo cuando |
|---|---|---|
| A · Precalificación | Lees el stack, escribes los permisos y la ruta protegida, y pruebas con token | Sin token 401, con token 200 y hay un ítem en la tabla |
| B · Cola y eventos | Conectas la cola al evaluador, escribes sus permisos y una regla; conectas la API | `/health` dice `queue: configured` y confirmaste el correo |
| C · Flujo completo | Creas una solicitud y la sigues hasta el correo | Pasó sola a `APROBADA`, llegó el correo y la web está en verde |
| D · Fallas | Envías un mensaje envenenado y uno duplicado | El duplicado se ignoró y el envenenado llegó a la cola de errores |
| E · Pipeline y apagar | Subes el trabajo por pull request y apagas | CI en verde y `npm run costos` no marca nada por hora |

> **Cómo se trabaja hoy.** Los dos stacks de esta sesión vienen **casi completos**. No vas a escribir doscientas líneas: vas a **leerlas** y a escribir las que deciden la seguridad y el comportamiento (los permisos, la ruta protegida, la conexión entre la cola y la función, una regla). Cada bloque trae preguntas de lectura: respóndelas con tu equipo antes de escribir.

> **Costo de hoy.** Todo lo nuevo (Lambda, API Gateway, Cognito, SQS, SNS, EventBridge, DynamoDB) cobra por uso y cabe en lo siempre gratuito: 0 USD. Lo que cobra por hora sigue siendo lo de la sesión 4, el balanceador y las dos tareas: unos 20 centavos en la sesión **si apagas al final**.

## Antes de empezar

Hazlo al llegar, antes del repaso: tarda unos 10 minutos y corre solo. **Abre Docker Desktop primero** (el despliegue construye la imagen de la API).

Revisa que tu archivo `.env` tenga tu correo real en `CF_ALERT_EMAIL`: ahí llegarán las notificaciones de hoy.

```bash
# Mac
aws login --profile crediflow
git checkout main && git pull
git checkout a05-inicio -- infra/lib/stacks infra/bin     # trae los esqueletos de hoy
npm install
source ./scripts/mac/load-env.sh
npm run encender                                           # unos 10 minutos: vuelve el balanceador y las tareas
```
```powershell
# Windows
aws login --profile crediflow
git checkout main; git pull
git checkout a05-inicio -- infra/lib/stacks infra/bin
npm install
. .\scripts\windows\load-env.ps1
npm run encender
```

Si el comando dice que no conoce `a05-inicio`: `git fetch base --tags` y repite.

`npm run encender` despliega también los dos stacks nuevos **en su versión incompleta** (`Serverless` y `Events`): existen, pero a la API le falta su ruta principal, a las funciones les faltan permisos y nadie lee la cola. Durante el laboratorio los completas y cada despliegue será una actualización corta.

Mientras corre, te llegará un correo de **AWS Notifications** con el asunto *Subscription Confirmation*. **Ábrelo y pulsa "Confirm subscription"** (revisa también el correo no deseado). Sin esa confirmación no recibirás nada en el bloque C.

## Bloque A · La precalificación, sin servidores (25 min)

### A1. Lee antes de escribir (8 min)

Abre estos tres archivos y responde con tu equipo:

1. `apps/precalificacion/src/motor.ts`, la regla de negocio. ¿Qué relación entre deudas e ingreso es la máxima permitida? ¿Hay algo de AWS en este archivo? Corre sus pruebas: `npm test -w apps/precalificacion`.
2. `apps/precalificacion/src/precalificar.ts`, la función. Ten a la vista la lámina "Una función de CrediFlow, línea por línea". ¿Qué se crea fuera del `handler` y por qué? ¿De dónde sale la identidad del usuario? ¿Con qué claves se guarda el resultado?
3. `infra/lib/stacks/serverless-stack.ts`, la infraestructura. Localiza el directorio de usuarios (`UserPool`), la tabla, las tres funciones y la API. ¿Qué rutas existen ya? ¿Cuál exige autenticación?

Si quieres discutir el diseño de las claves de la tabla, usa el prompt 5.2 de `docs/sesion-05/prompts.md`.

### A2. Escribe lo que falta (7 min)

En `serverless-stack.ts` hay tres `TODO (bloque A)`. Sustitúyelos por:

```ts
// 1. Debajo de la función precalificar: solo ESCRIBE en la tabla
this.table.table.grantWriteData(this.precalificarFn.fn);

// 2. Debajo de la función consultar: solo LEE de la tabla
this.table.table.grantReadData(consultarFn.fn);

// 3. En las rutas: la principal, protegida con el autorizador de Cognito
this.api.addRoute('precalificar', 'POST', this.precalificarFn.fn, { auth: true });
```

Piensa antes de desplegar: ¿qué pasaría si a `precalificar` le dieras `grantReadWriteData`? Funcionaría igual. La diferencia aparece el día que esa función tenga un defecto: con el permiso mínimo, no puede leer las precalificaciones de nadie.

Mira qué va a cambiar y despliega:

```bash
cd infra
npx cdk diff Serverless
npx cdk deploy Serverless
cd ..
```

`cdk diff` muestra, entre otras cosas, una tabla de **cambios de permisos de IAM**: dos políticas nuevas, una con acciones de escritura y otra con acciones de lectura, las dos limitadas a tu tabla. Como el cambio amplía permisos, `cdk deploy` te los enseña otra vez y pregunta si continúas: léelos y responde `y`. Tarda uno o dos minutos.

### A3. Un usuario y su token (5 min)

```bash
# Mac
export POOL_ID=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/user-pool-id --query Parameter.Value --output text)
export CLIENT_ID=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/user-pool-client-id --query Parameter.Value --output text)
export PRECAL_URL=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/precal-url --query Parameter.Value --output text)

aws cognito-idp admin-create-user --user-pool-id $POOL_ID --username ana@ejemplo.com \
  --user-attributes Name=email,Value=ana@ejemplo.com Name=email_verified,Value=true --message-action SUPPRESS
aws cognito-idp admin-set-user-password --user-pool-id $POOL_ID --username ana@ejemplo.com --password 'CrediFlow#2026' --permanent

export TOKEN=$(aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id $CLIENT_ID \
  --auth-parameters USERNAME=ana@ejemplo.com,PASSWORD='CrediFlow#2026' --query AuthenticationResult.IdToken --output text)
echo ${TOKEN:0:40}...
```
```powershell
# Windows
$env:POOL_ID = aws ssm get-parameter --name "/crediflow/$env:CF_STUDENT/dev/user-pool-id" --query Parameter.Value --output text
$env:CLIENT_ID = aws ssm get-parameter --name "/crediflow/$env:CF_STUDENT/dev/user-pool-client-id" --query Parameter.Value --output text
$env:PRECAL_URL = aws ssm get-parameter --name "/crediflow/$env:CF_STUDENT/dev/precal-url" --query Parameter.Value --output text

aws cognito-idp admin-create-user --user-pool-id $env:POOL_ID --username ana@ejemplo.com `
  --user-attributes Name=email,Value=ana@ejemplo.com Name=email_verified,Value=true --message-action SUPPRESS
aws cognito-idp admin-set-user-password --user-pool-id $env:POOL_ID --username ana@ejemplo.com --password 'CrediFlow#2026' --permanent

$env:TOKEN = aws cognito-idp initiate-auth --auth-flow USER_PASSWORD_AUTH --client-id $env:CLIENT_ID `
  --auth-parameters "USERNAME=ana@ejemplo.com,PASSWORD=CrediFlow#2026" --query AuthenticationResult.IdToken --output text
$env:TOKEN.Substring(0,40) + "..."
```

Ana es una usuaria ficticia con una contraseña de laboratorio. El token es una cadena larga en tres partes separadas por puntos y **caduca en una hora**: si más tarde recibes un 401 inesperado, repite el último comando.

Pega el token en <https://jwt.io>. Es un token de prueba de una usuaria que no existe: puede verse. Localiza `sub` (el identificador de la usuaria), `email`, `exp` (cuándo caduca) e `iss` (quién lo emitió: tu directorio de Cognito). Eso es lo que API Gateway comprueba antes de ejecutar tu función. **No pegues el token en el canal del curso ni en una IA.**

### A4. Sin token, 401; con token, 200 (5 min)

```bash
# Mac
curl -s ${PRECAL_URL}health
curl -s -X POST ${PRECAL_URL}precalificar -H "Content-Type: application/json" \
  -d '{"ingresoMensual":1500,"deudasMensuales":200,"montoSolicitado":8000,"plazoMeses":36}'
curl -s -X POST ${PRECAL_URL}precalificar -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"ingresoMensual":1500,"deudasMensuales":200,"montoSolicitado":8000,"plazoMeses":36}'
curl -s ${PRECAL_URL}precalificaciones -H "Authorization: Bearer $TOKEN"
```
```powershell
# Windows
$cuerpo = '{"ingresoMensual":1500,"deudasMensuales":200,"montoSolicitado":8000,"plazoMeses":36}'
Invoke-RestMethod "$($env:PRECAL_URL)health"
try { Invoke-RestMethod -Method Post -Uri "$($env:PRECAL_URL)precalificar" -ContentType application/json -Body $cuerpo } catch { $_.Exception.Response.StatusCode }
Invoke-RestMethod -Method Post -Uri "$($env:PRECAL_URL)precalificar" -ContentType application/json -Headers @{ Authorization = "Bearer $env:TOKEN" } -Body $cuerpo
Invoke-RestMethod "$($env:PRECAL_URL)precalificaciones" -Headers @{ Authorization = "Bearer $env:TOKEN" }
```

Qué debes ver, en orden: el estado de la API; `{"message":"Unauthorized"}` (401); un resultado con `elegible`, `dti`, `cuotaEstimada` y `montoMaximo` (200); y la lista de tus precalificaciones.

Comprueba que la llamada sin token **no ejecutó** la función, y mira el dato guardado:

```bash
aws logs tail /crediflow/$CF_STUDENT/dev/fn-precalificar --since 10m --format short
aws dynamodb scan --table-name crediflow-$CF_STUDENT-dev-tbl-precalificaciones --max-items 3 --query 'Items[].[pk.S,sk.S,elegible.BOOL]'
```

(Windows: `$env:CF_STUDENT` en lugar de `$CF_STUDENT`.) En los registros hay **una** sola invocación, la del 200. En la tabla, la clave `pk` es `USER#` seguido del `sub` que viste en el token.

En la consola, recorre: **Cognito → User pools → tu directorio → Users**; **API Gateway → tu API → Stages → v1**; **Lambda → tu función precalificar → Monitor**; **DynamoDB → Explore items**.

✅ **Listo cuando:** sin token recibes 401, con token 200, hay un ítem en la tabla con tu `sub` y puedes explicar por qué `precalificar` no tiene permiso de lectura.

## Bloque B · La cola, el evaluador y los eventos (25 min)

### B1. Lee antes de escribir (8 min)

1. `apps/worker/src/evaluador.ts`, con la lámina "Idempotencia" a la vista. Localiza `reclamar` y `liberar`. ¿Qué hace la función si el mensaje ya fue procesado? ¿Qué condición lleva la actualización de la solicitud y qué ocurre si el identificador no existe? ¿Qué publica al terminar?
2. `infra/lib/stacks/events-stack.ts`. Localiza la cola (¿cuántos intentos antes de la cola de errores?), la tabla de idempotencia (¿qué atributo hace que los ítems caduquen?), el bus, las dos funciones y la primera regla (¿a qué dos destinos envía cada evento?).
3. Discusión de equipo, la misma de la lámina "Piensa, comparte": ¿qué pasa si el evaluador se cae **después** de actualizar la tabla y **antes** de publicar el evento? Para contrastar, prompt 5.4.

### B2. Escribe lo que falta (7 min)

En `events-stack.ts` hay tres `TODO (bloque B)`.

Debajo de la función evaluador, la conexión con la cola y los permisos mínimos (borra también la línea `void lambdaEvents;`):

```ts
this.workerFn.fn.addEventSource(
  new lambdaEvents.SqsEventSource(this.queue.queue, {
    batchSize: 5,                    // hasta 5 mensajes por invocación
    reportBatchItemFailures: true,   // si uno falla, solo ese se reintenta
    maxConcurrency: 5,               // como mucho 5 ejecuciones a la vez
  }),
);
props.solicitudes.table.grantReadWriteData(this.workerFn.fn);
this.idempotencyTable.table.grantReadWriteData(this.workerFn.fn);
this.bus.grantPutEventsTo(this.workerFn.fn);
```

Debajo de la primera regla, la segunda, con filtro por contenido:

```ts
new events.Rule(this, 'RechazoAltoMontoRule', {
  ruleName: this.names.resource('rule-rechazo-alto'),
  eventBus: this.bus,
  eventPattern: {
    source: ['crediflow.evaluador'],
    detailType: ['SolicitudEvaluada'],
    detail: { resultado: ['RECHAZADA'], monto: [{ numeric: ['>=', 20000] }] },
  },
  targets: [new targets.LambdaFunction(notificadorFn.fn)],
});
```

Fíjate en lo que **no** tiene el notificador: ningún permiso sobre las tablas. Solo recibe eventos y escribe en sus registros.

### B3. Conecta la API a la cola (2 min)

Hasta hoy la API guardaba la solicitud y nada más. Ya sabe encolar: solo necesita conocer la cola. En `infra/bin/crediflow.ts`, busca el `TODO (sesión 5, bloque B)` y descomenta la línea:

```ts
queue: events.queue.queue,
```

Abre `service-stack.ts` y busca `props.queue`: cuando la cola existe, el stack le pasa a la API la variable `QUEUE_URL` y le da permiso de enviar mensajes, y solo de enviar.

### B4. Despliega los dos stacks (8 min)

```bash
cd infra
npx cdk diff Events Service
npx cdk deploy Events Service --require-approval never
cd ..
```

Antes de desplegar, lee el `diff`: en `Events`, la conexión de la cola con la función, tres políticas y una regla; en `Service`, una variable de entorno nueva en la definición de la tarea y una política para enviar mensajes. `Events` tarda un par de minutos; `Service` hace un despliegue gradual de las tareas (el de la sesión 4) y tarda unos 5.

Mientras termina, comprueba que **confirmaste la suscripción** del correo:

```bash
aws sns list-subscriptions --query "Subscriptions[?contains(TopicArn,'$CF_STUDENT-dev')].[Endpoint,SubscriptionArn]" --output table
```
```powershell
aws sns list-subscriptions --query "Subscriptions[?contains(TopicArn,'$($env:CF_STUDENT)-dev')].[Endpoint,SubscriptionArn]" --output table
```

Si en la segunda columna dice `PendingConfirmation`, busca el correo *Subscription Confirmation* y confírmalo.

Cuando el despliegue termine:

```bash
# Mac
export API_URL=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/api-url --query Parameter.Value --output text)
curl -s $API_URL/health
```
```powershell
# Windows
$env:API_URL = aws ssm get-parameter --name "/crediflow/$env:CF_STUDENT/dev/api-url" --query Parameter.Value --output text
Invoke-RestMethod "$env:API_URL/health"
```

✅ **Listo cuando:** `/health` responde `"queue":"configured"` y tu suscripción de correo está confirmada. Ahora, **receso de 10 minutos**.

## Bloque C · Una solicitud de punta a punta (15 min)

### C1. Créala y síguela

```bash
# Mac
curl -s -X POST $API_URL/solicitudes -H "Content-Type: application/json" \
  -d '{"nombre":"Ana Pérez","documento":"01234567-8","monto":5000,"plazoMeses":24,"ingresoMensual":1500,"proposito":"vivienda"}'
```
```powershell
# Windows
$s = Invoke-RestMethod -Method Post -Uri "$env:API_URL/solicitudes" -ContentType application/json `
  -Body '{"nombre":"Ana Pérez","documento":"01234567-8","monto":5000,"plazoMeses":24,"ingresoMensual":1500,"proposito":"vivienda"}'
$s
```

La respuesta llega al instante con `"estado":"EN_EVALUACION"`: la API guardó, encoló y contestó. Copia el `id` y, unos segundos después, pregunta por ella:

```bash
curl -s $API_URL/solicitudes/<id>          # Windows: Invoke-RestMethod "$env:API_URL/solicitudes/$($s.id)"
```

Ahora dice `"estado":"APROBADA"` y trae un `resultado` con el puntaje, la tasa, la cuota y el motivo. Nadie la tocó: la evaluó una función que no existía hasta que llegó el mensaje.

### C2. Sigue el rastro

```bash
aws logs tail /crediflow/$CF_STUDENT/dev/fn-evaluador --since 5m --format short
aws logs tail /crediflow/$CF_STUDENT/dev/fn-notificador --since 5m --format short
```

En el evaluador: `Solicitud evaluada`, con el resultado y el puntaje. En el notificador: `Notificación enviada (simulada)`, con el nombre de la regla que lo activó. Y en tu correo: *CrediFlow: la solicitud … fue APROBADA (monto 5000)*.

Cada línea de registro es un JSON con el identificador de la solicitud: en la sesión 6 buscaremos por él.

### C3. Las dos reglas

Crea una solicitud que será rechazada y que supera los 20,000:

```bash
# Mac
curl -s -X POST $API_URL/solicitudes -H "Content-Type: application/json" \
  -d '{"nombre":"Luis Gómez","documento":"07654321-0","monto":30000,"plazoMeses":24,"ingresoMensual":1000,"proposito":"consumo"}'
sleep 15
aws logs tail /crediflow/$CF_STUDENT/dev/fn-notificador --since 2m --format short
```
```powershell
# Windows
Invoke-RestMethod -Method Post -Uri "$env:API_URL/solicitudes" -ContentType application/json `
  -Body '{"nombre":"Luis Gómez","documento":"07654321-0","monto":30000,"plazoMeses":24,"ingresoMensual":1000,"proposito":"consumo"}'
Start-Sleep 15
aws logs tail "/crediflow/$env:CF_STUDENT/dev/fn-notificador" --since 2m --format short
```

El notificador se ejecutó **dos veces** para la misma solicitud: una por la regla general (`rule-evaluada`) y otra por la que escribiste (`rule-rechazo-alto`). El evaluador publicó un solo evento y no sabe nada de eso.

En la consola: **EventBridge → Buses → tu bus → Rules**: abre tu regla y mira el patrón. **SQS → tu cola → Monitoring**: mensajes recibidos y borrados.

### C4. CrediFlow completo, en la web

```bash
./scripts/mac/web-env.sh && (cd apps/web && npm run dev)          # Mac
```
```powershell
.\scripts\windows\web-env.ps1; cd apps\web; npm run dev           # Windows
```

En `http://localhost:3001`:

- **Estado:** las cuatro tarjetas en verde. Es la primera vez del curso.
- **Nueva solicitud:** créala y ve a **Solicitudes**: el estado cambia solo de *EN EVALUACIÓN* a *APROBADA* o *RECHAZADA*, sin recargar.
- **Precalificación:** inicia sesión con `ana@ejemplo.com` y `CrediFlow#2026`, y calcula. Es la misma API del bloque A; la web pidió el token por ti.

Detén la web con `Ctrl+C` y vuelve a la raíz del repositorio (`cd ../..`).

✅ **Listo cuando:** una solicitud pasó sola de `EN_EVALUACION` a `APROBADA`, te llegó el correo, viste las dos ejecuciones del notificador para el rechazo y la web muestra las cuatro tarjetas en verde.

## Bloque D · Provocar las fallas (20 min)

El orden importa: el mensaje envenenado tarda unos **9 minutos** en llegar a la cola de errores (tres intentos, separados por los 3 minutos que el mensaje pasa invisible). Envíalo primero y, mientras tanto, prueba el duplicado.

### D1. Envía un mensaje envenenado (y deja que corra)

Un mensaje bien formado, pero que apunta a una solicitud que no existe. El evaluador intentará actualizarla, la condición fallará y SQS lo reintentará.

```bash
# Mac
export QUEUE_URL=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/queue-url --query Parameter.Value --output text)
export DLQ_URL=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/dlq-url --query Parameter.Value --output text)
echo '{"tipo":"EvaluarSolicitud","solicitudId":"no-existe","solicitud":{"nombre":"Veneno","monto":1000,"plazoMeses":12,"ingresoMensual":1000,"proposito":"consumo"}}' > tmp-veneno.json
aws sqs send-message --queue-url $QUEUE_URL --message-body file://tmp-veneno.json --query MessageId
date
```
```powershell
# Windows
$env:QUEUE_URL = aws ssm get-parameter --name "/crediflow/$env:CF_STUDENT/dev/queue-url" --query Parameter.Value --output text
$env:DLQ_URL = aws ssm get-parameter --name "/crediflow/$env:CF_STUDENT/dev/dlq-url" --query Parameter.Value --output text
'{"tipo":"EvaluarSolicitud","solicitudId":"no-existe","solicitud":{"nombre":"Veneno","monto":1000,"plazoMeses":12,"ingresoMensual":1000,"proposito":"consumo"}}' | Set-Content tmp-veneno.json
aws sqs send-message --queue-url $env:QUEUE_URL --message-body file://tmp-veneno.json --query MessageId
Get-Date
```

Anota la hora. Mira el primer intento fallido:

```bash
aws logs tail /crediflow/$CF_STUDENT/dev/fn-evaluador --since 2m --format short
```

Verás un error `ConditionalCheckFailedException`. La función liberó la marca de idempotencia y avisó a SQS de que ese mensaje falló. Ahora el mensaje está invisible. Sigue con D2.

### D2. El mismo mensaje, dos veces

Crea una solicitud normal (la API la encola y el evaluador la procesa) y después envía a mano, dos veces, el mismo mensaje, como si SQS lo hubiera entregado repetido:

```bash
# Mac
ID=$(curl -s -X POST $API_URL/solicitudes -H "Content-Type: application/json" \
  -d '{"nombre":"Dup Test","documento":"11111111-1","monto":3000,"plazoMeses":12,"ingresoMensual":2000,"proposito":"consumo"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
echo '{"tipo":"EvaluarSolicitud","solicitudId":"ID_AQUI","solicitud":{"nombre":"Dup Test","monto":3000,"plazoMeses":12,"ingresoMensual":2000,"proposito":"consumo"}}' | sed "s/ID_AQUI/$ID/" > tmp-dup.json
sleep 10
aws sqs send-message --queue-url $QUEUE_URL --message-body file://tmp-dup.json --query MessageId
aws sqs send-message --queue-url $QUEUE_URL --message-body file://tmp-dup.json --query MessageId
sleep 10
aws logs tail /crediflow/$CF_STUDENT/dev/fn-evaluador --since 2m --format short | grep -i -E "duplicado|evaluada"
```
```powershell
# Windows
$ID = (Invoke-RestMethod -Method Post -Uri "$env:API_URL/solicitudes" -ContentType application/json `
  -Body '{"nombre":"Dup Test","documento":"11111111-1","monto":3000,"plazoMeses":12,"ingresoMensual":2000,"proposito":"consumo"}').id
('{"tipo":"EvaluarSolicitud","solicitudId":"ID_AQUI","solicitud":{"nombre":"Dup Test","monto":3000,"plazoMeses":12,"ingresoMensual":2000,"proposito":"consumo"}}').Replace('ID_AQUI', $ID) | Set-Content tmp-dup.json
Start-Sleep 10
aws sqs send-message --queue-url $env:QUEUE_URL --message-body file://tmp-dup.json --query MessageId
aws sqs send-message --queue-url $env:QUEUE_URL --message-body file://tmp-dup.json --query MessageId
Start-Sleep 10
aws logs tail "/crediflow/$env:CF_STUDENT/dev/fn-evaluador" --since 2m --format short | Select-String "duplicado|evaluada"
```

Resultado esperado: **una** línea `Solicitud evaluada` (la del mensaje que encoló la API) y **dos** `Mensaje duplicado ignorado (idempotencia)`. Tres mensajes, una evaluación, un correo.

Mira la marca que lo hizo posible: **DynamoDB → tu tabla `tbl-idempotencia` → Explore items**. Hay un ítem `SOLICITUD#<id>` con `expiresAt`: una fecha, en segundos, 24 horas en el futuro. Pasada esa fecha, DynamoDB lo borra solo.

Pregunta de equipo: ¿por qué la clave es el identificador de la **solicitud** y no el del **mensaje**?

### D3. El mensaje envenenado llega a la cola de errores

Unos 9 minutos después de D1:

```bash
aws sqs get-queue-attributes --queue-url $DLQ_URL --attribute-names ApproximateNumberOfMessages --query Attributes
aws sqs receive-message --queue-url $DLQ_URL --max-number-of-messages 1 --visibility-timeout 5 --attribute-names ApproximateReceiveCount --query 'Messages[0].[Body,Attributes]'
aws cloudwatch describe-alarms --alarm-names crediflow-$CF_STUDENT-dev-q-evaluaciones-dlq-messages --query 'MetricAlarms[0].[StateValue,StateReason]'
```

(Windows: `$env:DLQ_URL` y `$env:CF_STUDENT`.) Si el contador sigue en 0, espera un par de minutos: mientras tanto, cuenta los intentos en los registros del evaluador (`--since 12m`): deben ser tres.

Qué estás viendo: el mensaje, intacto, apartado en la cola de errores; `receive-message` lo **mira sin borrarlo** (vuelve a estar disponible a los 5 segundos); y la alarma pasa a `ALARM` uno o dos minutos después, con un correo a tu buzón. Así se entera un equipo de que la solicitud de un cliente no se pudo procesar.

### D4. Decide qué hacer con él

Con un mensaje en la cola de errores hay dos salidas:

- **Era basura** (como hoy): se purga.
- **Falló por una causa que ya corregiste** (un defecto, un servicio caído): se devuelve a la cola original para reprocesarlo. Es el *redrive*: `aws sqs start-message-move-task --source-arn <ARN de la cola de errores>`.

Hoy, púrgala y borra los archivos temporales:

```bash
aws sqs purge-queue --queue-url $DLQ_URL          # Windows: $env:DLQ_URL
rm tmp-veneno.json tmp-dup.json                   # Windows: Remove-Item tmp-veneno.json, tmp-dup.json
```

La alarma vuelve sola a `OK` en unos minutos.

✅ **Listo cuando:** viste dos duplicados ignorados y una sola evaluación; el mensaje envenenado llegó a la cola de errores después de tres intentos; y recibiste (o viste en estado `ALARM`) la alarma.

## Bloque E · Por el pipeline, y apagar (15 min)

### E1. Pull request

Lo que desplegaste desde tu máquina tiene que quedar en el repositorio, revisado:

```bash
git checkout -b feat/sesion-5-serverless
git add -A
git commit -m "feat: precalificación serverless y evaluación asíncrona"
git push -u origin feat/sesion-5-serverless
gh pr create --fill
```

Mientras corre el CI, pide a un compañero que revise **tus permisos**: ¿alguna función tiene más de lo que necesita? Cuando esté en verde:

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull          # Windows: git checkout main; git pull
```

En **Actions**, el job *Desplegar a dev* vuelve a desplegar todo desde `main`. Como ya lo habías desplegado tú con el mismo código, CloudFormation responde *no changes* en cada stack: es la prueba de que tu repositorio y tu cuenta dicen lo mismo. Tarda unos 5 minutos. Si tu equipo dejó pendiente el pull request del documento RTO/RPO de la sesión 4, fusiónalo ahora también.

**Espera a que el job termine** antes del paso siguiente: apagar con un despliegue en marcha deja stacks a medias.

### E2. Apaga

```bash
npm run apagar          # unos 10 minutos; el balanceador es lo que más tarda
npm run costos          # no debe marcar nada "por hora"
```

Hoy `apagar` borra también el directorio de usuarios, las tablas, la cola y el bus: en este curso todo se reconstruye desde el código en la sesión siguiente. En producción, las tablas y los usuarios se conservarían.

✅ **Listo cuando:** tu pull request está fusionado con el CI en verde, el job de dev terminó y `npm run costos` no marca ningún recurso por hora.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `git checkout a05-inicio` no reconoce la etiqueta | `git fetch base --tags` |
| Quiero repetir la prueba de carga de la sesión 4 | Puedes: `carga.js` crea solicitudes con nombres que empiezan por "Carga " y la regla de notificaciones las excluye, así que no envía correos. Pero cada solicitud se evalúa: 30 clientes durante 3 minutos son miles de evaluaciones |
| `npm run encender` falla al construir la imagen | Docker Desktop no está abierto. Ábrelo y repite |
| `cdk deploy` falla: `'lambdaEvents' is declared but never used` u otro error de TypeScript | Borraste el uso pero no el `void lambdaEvents;`, o al revés. Lee la línea que indica el error |
| `{"message":"Unauthorized"}` con token | El token caducó (dura una hora) o la variable está vacía: repite `initiate-auth`. Comprueba que envías `Authorization: Bearer` seguido del token |
| `{"message":"Missing Authentication Token"}` | La ruta no existe: falta el `addRoute` de `precalificar`, no desplegaste, o la dirección está mal escrita (`${PRECAL_URL}precalificar`, sin doble barra) |
| 502 `Internal server error` al precalificar | La función no tiene permiso sobre la tabla (`AccessDeniedException` en sus registros): falta `grantWriteData` |
| `NotAuthorizedException` al pedir el token | La contraseña no se fijó: repite `admin-set-user-password`. En Windows, respeta las comillas del ejemplo |
| La solicitud se queda en `EN_EVALUACION` | Tres causas: `/health` dice `queue: not-configured` (falta B3 o el despliegue de `Service`); falta la conexión de la cola con la función; o faltan permisos al evaluador (mira sus registros) |
| No llega el correo | La suscripción está en `PendingConfirmation`, o `CF_ALERT_EMAIL` estaba vacío al desplegar. Corrige `.env`, recarga el entorno y `npx cdk deploy Events` |
| La web no muestra la tarjeta de precalificación en verde | Vuelve a ejecutar `web-env` y reinicia `npm run dev`: las direcciones se leen al arrancar |
| El mensaje envenenado no llega a la cola de errores | Aún no pasan los 9 minutos. Cuenta los intentos en los registros del evaluador |
| El job de dev falla después de fusionar | Lo fusionaste con todo apagado, o apagaste antes de que terminara. Vuelve a lanzarlo en la próxima sesión, después de `npm run encender` |

## Cierre

### Checklist de verificación (por equipo)

Marca cada punto solo cuando **todos** los integrantes lo hayan completado.

- [ ] Leí `motor.ts`, `precalificar.ts` y `evaluador.ts`, y puedo explicar qué hace cada uno
- [ ] `Serverless` completo: sin token 401, con token 200, y un ítem en la tabla con mi `sub`
- [ ] Puedo explicar qué comprueba API Gateway en el token y por qué el token no debe llevar secretos
- [ ] Cada función tiene el permiso mínimo: `precalificar` solo escribe, `consultar` solo lee, el notificador no toca tablas
- [ ] `Events` completo y la API conectada a la cola (`queue: configured`)
- [ ] Una solicitud pasó sola de `EN_EVALUACION` a `APROBADA` y llegó el correo
- [ ] Vi las dos reglas actuar sobre un mismo evento (rechazo de 20,000 o más)
- [ ] La web muestra las cuatro tarjetas en verde y la precalificación funciona con inicio de sesión
- [ ] Idempotencia: tres mensajes de la misma solicitud, una sola evaluación; vi la marca con `expiresAt`
- [ ] Cola de errores: el mensaje envenenado llegó tras tres intentos y la alarma avisó
- [ ] Podemos explicar cuándo conviene un flujo asíncrono y qué exige "al menos una vez"
- [ ] Pull request fusionado con el CI en verde
- [ ] **`npm run apagar` terminado y `npm run costos` sin recursos por hora**

### Limpieza

Hoy no queda nada creado a mano en la cuenta. Comprueba que borraste `tmp-veneno.json` y `tmp-dup.json` y que no los subiste al repositorio (`git status` limpio).

### Para la sesión 6

1. Lee `docs/guia-observabilidad.md`: el simulacro de incidente se resuelve con ella.
2. Comprueba que `CF_ALERT_EMAIL` es un correo que puedes abrir en clase: las alarmas llegarán ahí.
3. Trae Docker Desktop instalado y abierto, como hoy.

### Reto para casa: pruebas límite del motor de precalificación

Opcional. No cuesta nada: todo ocurre en tu máquina y en el CI de tu repositorio. **No hay que encender nada.**

**Objetivo.** Encontrar los bordes de la regla de negocio de la precalificación y dejarlos cubiertos con pruebas automáticas.

**Cómo se hace.**

1. Lee `apps/precalificacion/src/motor.ts` y haz una tabla de casos límite. Algunos para empezar: una relación deuda/ingreso exactamente en 40 %; un ingreso de 399 y uno de 400; plazos de 12 y 13 meses, de 36 y 37, de 60 y 61; deudas mayores que el ingreso; el monto máximo cuando ya no queda capacidad de pago.
2. Para cada caso, decide **antes de ejecutar** qué resultado esperas y por qué.
3. Escribe al menos cinco pruebas nuevas en `apps/precalificacion/src/motor.test.ts`.
4. Si una prueba revela un comportamiento que te parece incorrecto para el negocio, **no cambies la regla**: documenta el caso y tu propuesta.

**Cómo comprobar que funciona.**

```bash
npm test -w apps/precalificacion
git checkout -b test/motor-limites && git add -A && git commit -m "test: casos límite del motor de precalificación"
git push -u origin test/motor-limites && gh pr create --fill
```

El CI de tu pull request debe ejecutar tus pruebas y terminar en verde. **No lo fusiones todavía:** con todo apagado, el despliegue fallaría por falta del rol. Lo fusionarás en la sesión 6, en el bloque E, junto con el trabajo de ese día.

**Qué entregas.** En el canal del curso: tu tabla de casos (entrada, resultado esperado, por qué es un borde), el enlace al pull request con el CI en verde y, si encontraste algo discutible, una frase explicándolo. Si usaste IA (prompt 5.1), cuenta qué le pediste y qué casos descartaste.

**Bonus.** Sustituye la idempotencia hecha a mano del evaluador por la utilidad *Idempotency* de Powertools for AWS Lambda, en una rama aparte, y compara cuántas líneas quedan. Solo código y pruebas locales: no hace falta desplegar.
