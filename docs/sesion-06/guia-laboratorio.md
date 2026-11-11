# Sesión 6 · Laboratorio: asegurar, observar y operar CrediFlow

## Cómo usar esta guía

**Duración:** 110 minutos efectivos más un receso de 10 minutos después del bloque B. **Equipos de 3-4 personas:** cada uno completa y despliega sus stacks en los bloques A, B y C; el simulacro y la demo se hacen **en equipo, sobre el entorno de un integrante**. **Entregables:** revisión de cdk-nag sin errores; `SecurityStack` y `ObservabilityStack` completos y desplegados; el runbook y el postmortem del equipo en `docs/sesion-06/`; la demo final; y **la cuenta limpia: cero recursos con tu etiqueta**.

Convención: los bloques `bash` son para **Mac**; los bloques `powershell` para **Windows (PowerShell 7)**. Si solo hay un bloque, el comando es igual en ambos. Los bloques `ts` son código TypeScript que escribes en VS Code.

Los cinco bloques y su "listo cuando":

| Bloque | Qué haces | Listo cuando |
|---|---|---|
| A · Revisión | Resuelves los dos errores de cdk-nag: corriges uno y reconoces el otro | `npm run nag` termina sin errores |
| B · WAF y rastro | Escribes la regla de tasa, asocias el WAF a la API y lo pruebas; consultas CloudTrail | Recibes 403 por contenido y por tasa |
| C · Observabilidad | Escribes la alarma de tareas sanas y un gráfico; consultas los registros | El tablero tiene datos y las 7 alarmas están en `OK` |
| D · Simulacro | Resuelves en equipo una falla inyectada y escribes el postmortem | Alarmas en `OK`, causa encontrada y postmortem escrito |
| E · Demo y limpieza | Muestras CrediFlow de punta a punta y lo borras todo | Demo hecha y cero recursos con tu etiqueta |

> **Cómo se trabaja hoy.** Como en la sesión 5, los stacks vienen casi completos: los lees y escribes lo que decide el comportamiento. En el simulacro no hay pasos que seguir: hay un método (detectar, mitigar, diagnosticar, corregir, aprender) y tu runbook.

> **Costo de hoy.** Aparecen recursos con precio mensual, prorrateado: el WAF (9 USD al mes), el tablero (3 USD) y las alarmas. En la sesión son unos 5 centavos, más los 20 del balanceador y las tareas. Olvidado un mes: unos 60 dólares por persona. **Hoy la limpieza es total y definitiva** (bloque E).

## Antes de empezar

Hazlo al llegar, antes del repaso: hoy tarda unos 12 minutos, porque se despliega CrediFlow entero. **Abre Docker Desktop primero.**

```bash
# Mac
aws login --profile crediflow
git checkout main && git pull
git checkout a06-inicio -- infra/lib/stacks infra/bin     # trae los esqueletos de hoy
npm install
source ./scripts/mac/load-env.sh
npm run encender
```
```powershell
# Windows
aws login --profile crediflow
git checkout main; git pull
git checkout a06-inicio -- infra/lib/stacks infra/bin
npm install
. .\scripts\windows\load-env.ps1
npm run encender
```

Si el comando dice que no conoce `a06-inicio`: `git fetch base --tags` y repite.

`npm run encender` despliega los ocho stacks, incluidos los dos de hoy **en su versión incompleta**: `Security` (el WAF, sin la regla de tasa y sin proteger todavía la API de precalificación) y `Observability` (el tablero y cinco de las seis alarmas).

Mientras corre, te llegarán **dos** correos de *AWS Notifications* con el asunto *Subscription Confirmation*: uno del tema de notificaciones (como en la sesión 5) y otro del tema de alertas. **Confirma los dos.** Sin eso no te llegará ninguna alarma en el simulacro.

Cuando termine, vuelve a crear a la usuaria de prueba (el directorio de usuarios se borró al apagar) y deja cargadas las variables que usarás toda la sesión:

```bash
# Mac
export API_URL=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/api-url --query Parameter.Value --output text)
export PRECAL_URL=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/precal-url --query Parameter.Value --output text)
export POOL_ID=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/user-pool-id --query Parameter.Value --output text)
aws cognito-idp admin-create-user --user-pool-id $POOL_ID --username ana@ejemplo.com \
  --user-attributes Name=email,Value=ana@ejemplo.com Name=email_verified,Value=true --message-action SUPPRESS
aws cognito-idp admin-set-user-password --user-pool-id $POOL_ID --username ana@ejemplo.com --password 'CrediFlow#2026' --permanent
curl -s $API_URL/health
```
```powershell
# Windows
$env:API_URL = aws ssm get-parameter --name "/crediflow/$env:CF_STUDENT/dev/api-url" --query Parameter.Value --output text
$env:PRECAL_URL = aws ssm get-parameter --name "/crediflow/$env:CF_STUDENT/dev/precal-url" --query Parameter.Value --output text
$env:POOL_ID = aws ssm get-parameter --name "/crediflow/$env:CF_STUDENT/dev/user-pool-id" --query Parameter.Value --output text
aws cognito-idp admin-create-user --user-pool-id $env:POOL_ID --username ana@ejemplo.com `
  --user-attributes Name=email,Value=ana@ejemplo.com Name=email_verified,Value=true --message-action SUPPRESS
aws cognito-idp admin-set-user-password --user-pool-id $env:POOL_ID --username ana@ejemplo.com --password 'CrediFlow#2026' --permanent
Invoke-RestMethod "$env:API_URL/health"
```

## Bloque A · La revisión automática (15 min)

### A1. Pasa la revisión

```bash
npm run nag
```

El comando sintetiza toda la aplicación con las reglas de cdk-nag activadas. Termina con `Synthesis finished with errors` y, al final de la salida, dos hallazgos con esta forma:

```
ERROR AwsSolutions-EC23: The Security Group allows for 0.0.0.0/0 or ::/0 inbound access. ...
   Service/Api/Service/LB/SecurityGroup/Resource

ERROR AwsSolutions-COG1: The Cognito user pool does not have a password policy that minimally specify ...
   Serverless/UserPool/Resource
```

Cada uno trae la regla, la explicación y, debajo, el recurso al que se refiere. Son **dos errores**. El resto de las reglas (unas 150) ya pasa, o ya está reconocido.

El informe completo queda en `infra/cdk.out`, un archivo CSV por stack (`AwsSolutions-…-NagReport.csv`): cada regla evaluada, sobre qué recurso, si cumple y, si se reconoció, con qué razón. Abre el de `Service` y busca las filas que dicen `Suppressed`.

Ahora abre `infra/bin/crediflow.ts`, busca la función `aplicarReconocimientos` y lee tres o cuatro de las razones escritas ahí. Son decisiones de costo y de alcance tomadas a lo largo del curso; por ejemplo, la de `DDB3`: la recuperación a un punto en el tiempo solo se activa en producción.

### A2. Clasifica con tu equipo

Para cada hallazgo, decidan: **¿se corrige o se reconoce?** Antes de seguir leyendo, discútanlo dos minutos. Si quieren que la IA les explique un hallazgo, usen el prompt 6.1 de `docs/sesion-06/prompts.md`; la decisión es del equipo.

| Hallazgo | Qué dice | Decisión |
|---|---|---|
| `COG1` | El directorio de usuarios no exige contraseñas con mayúsculas, minúsculas, números y símbolos | **Corregir.** Es una API financiera y cuesta una línea |
| `EC23` | El balanceador acepta tráfico desde cualquier dirección | **Reconocer.** Es una API pública: ese es su trabajo. Hay que explicar qué la protege |

### A3. Corrige uno

En `infra/lib/stacks/serverless-stack.ts`, completa la política de contraseñas del directorio de usuarios:

```ts
passwordPolicy: { minLength: 10, requireDigits: true, requireUppercase: true, requireLowercase: true, requireSymbols: true },
```

### A4. Reconoce el otro, con una razón de verdad

En `infra/bin/crediflow.ts` hay un `TODO (sesión 6, bloque A)`, dentro de la lista de reconocimientos del stack `service`. Agrega una línea:

```ts
{ id: 'AwsSolutions-EC23', reason: '<tu razón>' },
```

**Escribe tú la razón.** Una razón sirve si responde tres cosas: qué se decidió, por qué, y qué compensa el riesgo. "No aplica" o "es un curso" no sirven. Pistas: ¿quién es el único que puede hablar con las tareas?, ¿qué hay delante del balanceador desde hoy? Toma como modelo las razones que leíste en A1.

### A5. Repite hasta que pase

```bash
npm run nag
```

Debe terminar sin ningún `ERROR` y sin el aviso `Synthesis finished with errors`. Despliega la corrección (la política de contraseñas es un cambio real en tu directorio de usuarios):

```bash
cd infra
npx cdk deploy Serverless --require-approval never
cd ..
```

Desde hoy, el CI de tu repositorio ejecuta esta misma revisión: un pull request con un error de cdk-nag no pasa.

✅ **Listo cuando:** `npm run nag` termina sin errores, tu razón convencería a un auditor (léesela a tu equipo) y `Serverless` está desplegado.

## Bloque B · El WAF y el rastro de auditoría (15 min)

### B1. Lee el stack (3 min)

Abre `infra/lib/stacks/security-stack.ts` con la lámina "AWS WAF" a la vista. ¿Qué hace el conjunto de reglas con una petición que no coincide con ninguna regla (`defaultAction`)? ¿Cuántos grupos de reglas administradas hay y en qué orden se evalúan? ¿A qué recurso está asociado el WAF ahora mismo, y cuál falta? ¿Dónde se guardan sus registros?

### B2. Escribe lo que falta (4 min)

Hay dos `TODO (bloque B)`. Dentro de la lista `rules`, después de las reglas administradas, la regla de límite de tasa:

```ts
{
  name: 'RateLimitPorIp',
  priority: 10,
  action: { block: {} },
  statement: { rateBasedStatement: { limit: 500, aggregateKeyType: 'IP' } },   // 500 peticiones en 5 minutos por IP
  visibilityConfig: { sampledRequestsEnabled: true, cloudWatchMetricsEnabled: true, metricName: 'RateLimitPorIp' },
},
```

Y debajo de la asociación con el balanceador, la asociación con la API de precalificación:

```ts
new wafv2.CfnWebACLAssociation(this, 'ApiAssociation', {
  resourceArn: props.restApi.deploymentStage.stageArn,
  webAclArn: this.webAcl.attrArn,
});
```

```bash
cd infra
npx cdk diff Security
npx cdk deploy Security --require-approval never
cd ..
```

Tarda un par de minutos.

### B3. Tres peticiones maliciosas (3 min)

```bash
# Mac
curl -s -o /dev/null -w "%{http_code}\n" "$API_URL/solicitudes?q=<script>alert(1)</script>"       # inyección de script
curl -s -o /dev/null -w "%{http_code}\n" "$API_URL/health" -H "User-Agent:"                        # sin agente de usuario
curl -s -o /dev/null -w "%{http_code}\n" "$API_URL/health" -H 'X-Api-Version: ${jndi:ldap://x/a}'  # patrón de Log4Shell
curl -s -o /dev/null -w "%{http_code}\n" "${PRECAL_URL}health?q=<script>alert(1)</script>"         # la otra puerta
curl -s -o /dev/null -w "%{http_code}\n" "$API_URL/health"                                         # una petición normal
```
```powershell
# Windows
function Codigo($uri, $h = @{}) { (Invoke-WebRequest $uri -Headers $h -SkipHttpErrorCheck).StatusCode }
Codigo "$env:API_URL/solicitudes?q=<script>alert(1)</script>"
Codigo "$env:API_URL/health" @{ 'X-Api-Version' = '${jndi:ldap://x/a}' }
Codigo "$($env:PRECAL_URL)health?q=<script>alert(1)</script>"
Codigo "$env:API_URL/health"
```

Las maliciosas reciben **403** y la normal **200**. La aplicación nunca vio las primeras: no hay rastro de ellas en los registros de la API. Sí lo hay en los del WAF:

```bash
aws logs tail aws-waf-logs-crediflow-$CF_STUDENT-dev --since 10m --format short | head -5          # Windows: $env:CF_STUDENT
```

Cada línea dice qué regla actuó (`terminatingRuleId`) y sobre qué petición. En la consola: **WAF & Shield → Web ACLs → tu conjunto → Traffic overview** y **Sampled requests**.

### B4. El rastro de auditoría (3 min)

Dos preguntas al historial de CloudTrail, que lleva activado desde el primer día sin que hiciéramos nada:

```bash
aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity \
  --max-results 5 --query 'Events[].[EventTime,Username]' --output table
aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=StopTask \
  --max-results 5 --query 'Events[].[EventTime,Username]' --output table
```

(Windows: en una sola línea, sin la barra invertida.) La primera muestra al pipeline de GitHub entrando a la cuenta por OIDC, con el nombre del repositorio. La segunda, quién detuvo tareas a mano: ahí están los `stop-task` de la sesión 4, con el nombre de cada usuario. Guarda este comando: en el simulacro lo vas a necesitar.

El instructor mostrará en su pantalla **GuardDuty** con hallazgos de muestra: cómo se ve un aviso de credenciales usadas desde un lugar inusual o de minería de criptomonedas.

### B5. La ráfaga (2 min, justo antes del receso)

```bash
node scripts/load/carga.js $API_URL 40 10 health          # Windows: $env:API_URL
```

Son diez clientes pidiendo `/health` sin parar durante 40 segundos. Las primeras centenas de peticiones salen bien; después, el contador de errores empieza a subir: el WAF está respondiendo 403 a tu IP. Compruébalo:

```bash
curl -s -o /dev/null -w "%{http_code}\n" $API_URL/health          # 403
```

**Tu IP queda bloqueada unos minutos**, hasta que tu tasa vuelva a bajar de 500 peticiones en 5 minutos. Por eso esta prueba se hace justo antes del receso. (En el aula todos salen a internet por la misma dirección, pero cada quien tiene su propio conjunto de reglas: no bloqueas a tus compañeros.)

✅ **Listo cuando:** recibiste 403 por contenido en las dos puertas y por tasa, viste la regla que actuó en los registros del WAF y encontraste tus propios `stop-task` en CloudTrail. Ahora, **receso de 10 minutos**.

## Bloque C · Hacer observable a CrediFlow (15 min)

### C1. Lee el stack (3 min)

Abre `infra/lib/stacks/observability-stack.ts` con la lámina "Alarmas que sirven". Localiza las métricas (¿de qué servicios salen?, ¿cuáles son de negocio?), las cinco alarmas ya escritas (¿qué umbral y durante cuánto tiempo cada una?, ¿qué runbook nombran?) y el tablero (¿qué señal dorada muestra cada fila?).

### C2. Escribe lo que falta (5 min)

Hay cuatro `TODO (bloque C)`. La alarma que falta (borra también `void healthyHosts;`):

```ts
const alarmHealthy = new cloudwatch.Alarm(this, 'HealthyHostsAlarm', {
  alarmName: this.names.resource('alarm-api-hosts'),
  alarmDescription: 'Menos de 2 tareas sanas detrás del ALB. Runbook RB-01.',
  metric: healthyHosts,
  threshold: 2,
  evaluationPeriods: 2,
  comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
  treatMissingData: cloudwatch.TreatMissingData.BREACHING,   // sin datos = sin tareas = alarma
});
```

Agrégala en los dos sitios que lo piden: en `this.alerts.bind(...)`, para que avise por correo, y en la lista `alarms` del widget de estado del tablero.

Y el gráfico de saturación, el primero de su fila (borra también `void ecsCpu; void ecsMem;`):

```ts
new cloudwatch.GraphWidget({ title: 'Saturación ECS (%)', left: [ecsCpu, ecsMem], width: 8 }),
```

Pregunta de equipo: todas las demás alarmas tratan la falta de datos como "todo bien". ¿Por qué esta no?

```bash
cd infra
npx cdk deploy Observability --require-approval never
cd ..
```

### C3. Tráfico de fondo y tablero (3 min)

Sin tráfico no hay datos, y sin datos no hay nada que observar. En **una terminal aparte**, que dejarás abierta hasta el final del simulacro:

```bash
# Terminal de tráfico (carga el entorno y API_URL antes)
node scripts/load/carga.js $API_URL 2400 1 4000          # Windows: $env:API_URL
```

Crea una solicitud cada 4 segundos durante 40 minutos. Va muy por debajo del límite del WAF, y como sus nombres empiezan por "Carga", no envía correos. Fíjate en su contador: `ok` sube, `err` se queda en 0. **Esa terminal es tu cliente**: si algo falla, ahí se nota.

Abre el tablero:

```bash
aws cloudformation describe-stacks --stack-name CrediFlow-$CF_STUDENT-dev-Observability --query "Stacks[0].Outputs[?OutputKey=='DashboardUrl'].OutputValue" --output text
```

(Windows: `$env:CF_STUDENT`.) Dale dos o tres minutos para llenarse y recórrelo: tráfico, errores, latencia; saturación (tu gráfico), cola y errores de Lambda; las cifras de negocio; y el estado de las alarmas. Comprueba las alarmas por CLI:

```bash
aws cloudwatch describe-alarms --alarm-name-prefix crediflow-$CF_STUDENT-dev --query 'MetricAlarms[].[AlarmName,StateValue]' --output table
```

Siete alarmas (las seis de hoy y la de la cola de errores de la sesión 5). Alguna puede estar en `INSUFFICIENT_DATA` un par de minutos; después, todas en `OK`.

### C4. Tres consultas sobre los registros (4 min)

En la consola: **CloudWatch → Logs Insights**. Elige el grupo `/crediflow/<tu usuario>/dev/api`, el rango "últimos 30 minutos" y ejecuta:

```
stats count(*) as peticiones, avg(durationMs) as promedio, pct(durationMs, 95) as p95 by path
| sort peticiones desc
```

Ahora el grupo `/crediflow/<tu usuario>/dev/fn-evaluador`:

```
filter message = "Solicitud evaluada"
| stats count(*) as total, avg(score) as puntajePromedio by resultado
```

Y la que más vas a usar: todo lo que pasó con **una** solicitud. Copia un `solicitudId` de la consulta anterior (quita el `stats` para ver las líneas), selecciona **los dos grupos a la vez** y ejecuta:

```
fields @timestamp, @log, message, level
| filter solicitudId = "<el id>" or @message like "<el id>"
| sort @timestamp asc
```

Guarda las tres (**Save**). Con el prompt 6.2 puedes pedirle a la IA más consultas en lenguaje natural; se verifican ejecutándolas.

Si te sobra un minuto: **Lambda → tu función precalificar → Monitor → Traces**, o **CloudWatch → X-Ray traces → Trace Map**: el recorrido de una petición, tramo a tramo.

✅ **Listo cuando:** el tablero muestra tráfico y cifras de negocio, las siete alarmas están en `OK`, tu terminal de tráfico sigue corriendo y tienes tres consultas guardadas.

## Bloque D · Simulacro de incidente (30 min, por equipos)

### D1. Preparación (5 min)

1. **Elijan el entorno del equipo:** el de un integrante, con su tablero proyectado o compartido y su terminal de tráfico corriendo. Díganle al instructor de quién es.
2. **Repartan los roles:** quien **coordina** (decide, lleva el reloj y habla con el instructor; no teclea), quien **investiga** (uno o dos, en el entorno elegido) y quien **anota** la línea de tiempo con horas exactas.
3. **Preparen el runbook.** Una persona lo copia y lo comparte:

```bash
cp docs/plantillas/runbook.md docs/sesion-06/runbook-<equipo>.md
cp docs/plantillas/postmortem.md docs/sesion-06/postmortem-<equipo>.md
```

Completen la sección "Datos generales" del runbook con los nombres reales del entorno elegido y lean en voz alta los títulos de RB-01 y RB-02: cuando suene una alarma, su descripción dirá cuál abrir.

### D2. El incidente (20 min)

**Las reglas.** El instructor inyecta **una** falla en el entorno del equipo, a mano, sin decir cuál ni cuándo. A partir de ahí:

1. **Detectar.** ¿Qué lo avisó primero: una alarma, el tablero, la terminal de tráfico? Anoten la hora.
2. **Mitigar.** Que el cliente deje de sufrir, aunque todavía no entiendan todo.
3. **Diagnosticar.** ¿Qué cambió exactamente? ¿Quién lo cambió y a qué hora?
4. **Corregir.** Que la cuenta vuelva a decir lo que dice el código.
5. **Verificar.** Alarmas en `OK`, la terminal de tráfico sin errores nuevos.

Se puede usar la IA como asistente de diagnóstico (prompt 6.3): pide hipótesis y el comando para comprobar cada una. No es un oráculo: nada es un hecho hasta que un comando lo confirma.

**Caja de herramientas.** No son pasos: son las preguntas que suelen acotar un problema.

```bash
# ¿Qué alarmas suenan, y desde cuándo?
aws cloudwatch describe-alarms --state-value ALARM --query 'MetricAlarms[].[AlarmName,StateUpdatedTimestamp,AlarmDescription]' --output table

# ¿La API responde desde fuera?
curl -s -o /dev/null -w "%{http_code}\n" $API_URL/health

# ¿Cómo está el servicio y qué dicen sus últimos eventos?
aws ecs describe-services --cluster crediflow-$CF_STUDENT-dev-api-cluster --services crediflow-$CF_STUDENT-dev-api \
  --query 'services[0].[desiredCount,runningCount,events[0:4].message]'

# ¿Se acumulan mensajes? (los que esperan y los que están en proceso)
aws sqs get-queue-attributes --queue-url $(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/queue-url --query Parameter.Value --output text) \
  --attribute-names ApproximateNumberOfMessages ApproximateNumberOfMessagesNotVisible --query Attributes

# ¿Qué dice el evaluador?
aws logs tail /crediflow/$CF_STUDENT/dev/fn-evaluador --since 10m --format short

# ¿Qué se cambió hace poco, y quién? (los eventos tardan unos minutos en aparecer)
aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventSource,AttributeValue=lambda.amazonaws.com \
  --max-results 20 --query 'Events[].[EventTime,EventName,Username]' --output table
aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventSource,AttributeValue=ec2.amazonaws.com \
  --max-results 20 --query 'Events[].[EventTime,EventName,Username]' --output table

# ¿La cuenta coincide con el código?
cd infra && npx cdk drift Events Service; cd ..
```

(Windows: `$env:CF_STUDENT` y `$env:API_URL`; los comandos largos, en una sola línea.) El resto está en tu runbook, que para eso existe.

**Sobre la deriva.** `cdk drift` compara cada recurso real con lo que declara tu código. Anoten qué ve **y qué no ve**: solo revisa las propiedades que el código declara. Y recuerden que `cdk diff` no sirve para esto, y que volver a desplegar no corrige nada si el código no cambió: lo que se cambió a mano se devuelve a mano al valor del código, y se comprueba.

**Si a los 15 minutos no han mitigado**, el coordinador pide una pista al instructor. Pedirla a tiempo también es operar bien.

### D3. El postmortem (5 min, y se termina después)

Con la línea de tiempo de quien anotó, completen `docs/sesion-06/postmortem-<equipo>.md`. Lo mínimo antes de la demo: resumen de tres líneas, impacto (¿cuántas solicitudes se retrasaron o fallaron?, lo dice la terminal de tráfico y el tablero), línea de tiempo, causa raíz y **dos acciones** con responsable.

Tres preguntas que el documento debe responder: ¿cuánto tardamos en detectar y cuánto en mitigar? ¿Qué nos habría avisado antes? ¿Qué impediría que alguien vuelva a hacer ese cambio a mano?

Es un postmortem **sin culpables**: la pregunta es qué lo permitió, no quién fue (aunque CloudTrail ya se lo dijo). Para el borrador, prompt 6.4: la IA redacta, el equipo edita.

Agreguen al runbook el paso que les habría ahorrado más tiempo.

✅ **Listo cuando:** las alarmas volvieron a `OK`, la terminal de tráfico no muestra errores nuevos, saben qué se cambió, quién y cuándo, y el postmortem tiene resumen, línea de tiempo, causa y dos acciones.

## Bloque E · Demo final y limpieza total (25 min)

### E1. Demo: cuatro minutos por equipo

En vivo, sobre el entorno del equipo, y **cada integrante presenta una parte**:

1. **Una solicitud, de la web al correo.** `web-env`, `npm run dev` en `apps/web`, crear una solicitud y verla pasar sola de *EN EVALUACIÓN* a *APROBADA*; enseñar el correo.
2. **La precalificación con inicio de sesión** (`ana@ejemplo.com`), en la misma web.
3. **El tablero**, con el tráfico de la sesión y la huella del incidente; y en una frase, qué pasó y cómo lo resolvieron.
4. **Una pregunta del instructor** sobre cualquier parte del código o de la arquitectura.

Para ensayar el guion de los cuatro minutos, prompt 6.6.

La evaluación recorre el curso, sobre 100 puntos:

| Criterio | Qué se mira | Puntos |
|---|---|---|
| Infraestructura como código | Stacks completos, nombres y etiquetas, pruebas de infraestructura | 20 |
| Automatización | Pull requests con CI en verde y despliegue por el pipeline, sin secretos | 10 |
| Escalabilidad y disponibilidad | Dos zonas, autorreparación, autoscaling, rollback y documento RTO/RPO | 20 |
| Serverless y eventos | API con autenticación, flujo asíncrono, idempotencia y cola de errores | 20 |
| Seguridad | Permisos mínimos, revisión sin errores, supresiones con razón, WAF | 15 |
| Monitoreo y operación | Tablero, alarmas, runbook, simulacro resuelto y postmortem | 15 |

Constancia del curso: asistencia a 5 de las 6 sesiones y nota final de 70 o más.

### E2. Entrega el trabajo

Detén la terminal de tráfico y la web (`Ctrl+C`). Hoy, **antes de fusionar, desactiva el despliegue automático**: tu entorno está a punto de desaparecer y el job fallaría.

```bash
gh workflow disable deploy.yml
git checkout -b feat/sesion-6-operacion
git add -A
git commit -m "feat: seguridad, observabilidad, runbook y postmortem"
git push -u origin feat/sesion-6-operacion
gh pr create --fill
```

El CI ejecuta las pruebas y la revisión de cdk-nag. Cuando esté en verde, fusiona (y fusiona también, si lo tienes abierto, el pull request del reto de la sesión 5):

```bash
gh pr merge --squash --delete-branch
git checkout main && git pull          # Windows: git checkout main; git pull
```

Una sola persona del equipo sube el runbook y el postmortem; los demás suben su código.

### E3. Limpieza total

No esperes al final de las demos: lánzalo en cuanto tu equipo haya presentado.

```bash
npm run apagar          # unos 12 minutos
npm run costos          # nada por hora
```

Y comprueba que no queda **nada** con tu etiqueta:

```bash
aws resourcegroupstaggingapi get-resources --tag-filters Key=Student,Values=$CF_STUDENT \
  --query 'ResourceTagMappingList[].ResourceARN' --output table          # Windows: $env:CF_STUDENT
```

La lista debe salir vacía. Algún recurso recién borrado puede seguir apareciendo unos minutos; si pasados diez sigue ahí, avisa al instructor. Si te quedó algo del laboratorio 1 o del despliegue manual de la sesión 2, los comandos están en `docs/00-preparacion/limpieza.md`.

Por último, cierra tu sesión:

```bash
aws logout --profile crediflow
```

Tu usuario de AWS se desactivará al terminar el curso. **Tu repositorio de GitHub es tuyo y se queda contigo:** sintetizar, probar y pasar la revisión no necesitan una cuenta de AWS.

✅ **Listo cuando:** tu equipo presentó, tu pull request está fusionado, `npm run apagar` terminó y la consulta por etiqueta sale vacía.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `git checkout a06-inicio` no reconoce la etiqueta | `git fetch base --tags` |
| `npm run nag` sigue mostrando `COG1` | Falta `requireLowercase` o `requireSymbols` en la política de contraseñas, o editaste otro archivo |
| `npm run nag` sigue mostrando `EC23` | La línea debe ir dentro de la lista de reconocimientos del stack `service`, que termina en `], true);` |
| Error de TypeScript: una variable "is declared but never used" | Borra la línea `void …;` solo cuando hayas escrito el código que usa esa variable |
| La petición con `<script>` responde 200 o 404 | `Security` no terminó de desplegarse, o la petición no lleva el parámetro (en PowerShell, usa comillas dobles como en el ejemplo) |
| Todo responde 403, incluso `/health` | Es el límite de tasa: tu IP sigue bloqueada tras la ráfaga. Espera 5 minutos sin enviar tráfico |
| La terminal de tráfico muestra errores desde el principio | La lanzaste con la IP aún bloqueada (403), o `API_URL` está vacía en esa terminal |
| El tablero está vacío | Faltan 2-3 minutos de tráfico, o el rango del tablero es muy amplio: elige "1h" |
| Una alarma se queda en `INSUFFICIENT_DATA` | Normal sin tráfico en esa métrica. `alarm-api-hosts` no debe estarlo: si lo está, revisa `treatMissingData` |
| No llegan los correos de las alarmas | Falta confirmar la suscripción del tema `topic-alertas` (hay dos correos de confirmación, no uno) |
| Logs Insights no devuelve nada | Revisa el grupo elegido y el rango de tiempo; los campos distinguen mayúsculas |
| `cdk drift` no reconoce el comando | `npm install` para actualizar la CLI; alternativa en la consola: **CloudFormation → tu stack → Stack actions → Detect drift** |
| CloudTrail no muestra el cambio | Los eventos tardan hasta 15 minutos en aparecer. Sigue con el diagnóstico y vuelve a consultar |
| El CI del pull request falla en "Sintetizar con cdk-nag" | Queda un error de cdk-nag: ejecútalo en tu máquina y corrígelo |
| `npm run apagar` falla en un stack | Repite el comando. Si persiste, anota el stack y avisa al instructor antes de irte |

## Cierre

### Checklist de verificación (por equipo)

Marca cada punto solo cuando **todos** los integrantes lo hayan completado.

- [ ] `npm run nag` sin errores: un hallazgo corregido y otro reconocido con una razón que explica qué, por qué y qué lo compensa
- [ ] `Security` completo: 403 por contenido en las dos puertas y 403 por tasa
- [ ] Vi en los registros del WAF qué regla bloqueó cada petición
- [ ] Encontré en CloudTrail la entrada del pipeline por OIDC y mis propios `stop-task`
- [ ] `Observability` completo: tablero con datos y siete alarmas en `OK`
- [ ] Puedo explicar por qué `alarm-api-hosts` trata la falta de datos como alarma
- [ ] Tres consultas de Logs Insights guardadas, incluida la que sigue una solicitud por su identificador
- [ ] Simulacro: detectamos en ____ min y mitigamos en ____ min; sabemos qué se cambió, quién y cuándo
- [ ] Sabemos qué vio y qué no vio la detección de deriva, y por qué `cdk diff` no la muestra
- [ ] Runbook del equipo completado, con un paso nuevo aprendido en el simulacro
- [ ] Postmortem sin culpables con resumen, impacto, línea de tiempo, causa raíz y acciones
- [ ] Demo final presentada; cada integrante explicó una parte
- [ ] Pull request final fusionado con el CI en verde
- [ ] **`npm run apagar` terminado y cero recursos con mi etiqueta `Student`**

### Después del curso

1. **Tu repositorio.** Es un proyecto de referencia completo: ocho stacks, pipeline, pruebas, runbook y postmortem. Úsalo como plantilla. El despliegue automático quedó desactivado; para usarlo en otra cuenta, sigue `docs/00-preparacion/acceso-aws.md` y vuelve a activarlo con `gh workflow enable deploy.yml`.
2. **Lo que no vimos** y es el siguiente paso: varias cuentas con AWS Organizations, redes privadas con NAT o con *endpoints*, Aurora, CloudFront y dominios propios, Step Functions y EKS.
3. **Certificación.** Con este curso estás cerca de *AWS Certified Cloud Practitioner*; el siguiente, y el más útil para tu trabajo, es *Solutions Architect – Associate*.
4. **La regla que no caduca:** nunca datos, sistemas ni credenciales reales en un entorno de práctica ni en una IA.

### Reto final: una alarma más, con su prueba y su runbook

Opcional. No cuesta nada y no necesita la cuenta de AWS: todo ocurre en tu máquina y en el CI de tu repositorio.

**Objetivo.** Agregar la alarma que le falta a la precalificación y dejarla como se deja el trabajo terminado: en código, probada y documentada.

**Cómo se hace.**

1. En `infra/lib/stacks/observability-stack.ts`, crea una alarma sobre los errores 5xx de API Gateway (la métrica `apigw5xx` ya existe en el archivo): 3 o más en un minuto, con el nombre `alarm-precal-5xx` y una descripción que termine en "Runbook RB-03".
2. Agrégala a `this.alerts.bind(...)` y al widget de estado de alarmas del tablero.
3. En `infra/test/`, escribe una prueba para `ObservabilityStack` que compruebe dos cosas: que el stack tiene 7 alarmas, y que la descripción de todas nombra un runbook. Toma como modelo las pruebas de la sesión 3.
4. En tu runbook, completa RB-03 con el primer paso: "si suena esta alarma, lo primero que miro es…".

**Cómo comprobar que funciona.**

```bash
npm test -w infra
npm run nag
git checkout -b feat/alarma-precal && git add -A && git commit -m "feat: alarma de errores de la precalificación, con prueba"
git push -u origin feat/alarma-precal && gh pr create --fill
```

El CI debe terminar en verde. Con el despliegue desactivado, puedes fusionarlo sin problema.

**Qué entregas.** En el canal del curso: el enlace al pull request con el CI en verde y el paso que agregaste a RB-03. Si usaste IA, cuenta qué le pediste y qué corregiste.

**Bonus.** Haz que la prueba falle a propósito (quita el runbook de una descripción), mira el CI en rojo y vuelve a dejarla bien. Acabas de impedir que alguien, dentro de un año, cree una alarma que nadie sabe atender.
