# Sesión 4 · Laboratorio: la API en contenedores, con balanceador, autoscaling y rollback

## Cómo usar esta guía

**Duración:** 100 minutos efectivos más un receso de 10 minutos después del bloque B. **Equipos de 3-4 personas:** cada uno despliega su propio servicio; el equipo llena un solo documento RTO/RPO y valida el checklist. **Entregable:** `ServiceStack` desplegado por el pipeline; las pruebas de autorreparación, carga y rollback realizadas; el documento `rto-rpo-<equipo>.md` con dos valores medidos; y **todo apagado antes de salir**.

Convención: los bloques `bash` son para **Mac**; los bloques `powershell` para **Windows (PowerShell 7)**. Si solo hay un bloque, el comando es igual en ambos. Los bloques `ts` son código TypeScript que escribes en VS Code.

Los cinco bloques y su "listo cuando":

| Bloque | Qué haces | Listo cuando |
|---|---|---|
| A · Contenedor | Construyes y corres la imagen de la API en tu máquina | El contenedor responde `/health` y aparece *healthy* |
| B · Servicio | Escribes `ServiceStack` y lo despliegas por el pipeline; mientras, RTO y RPO | El job de dev terminó y el documento tiene objetivos |
| C · Verificar | Compruebas dos tareas en dos zonas y conectas la web | `/info` alterna entre dos tareas y la web está en verde |
| D · Matar y cargar | Detienes una tarea y lanzas una prueba de carga | `/health` nunca falló y el servicio subió a 3 o 4 tareas |
| E · Romper y apagar | Despliegas una versión rota, ves el rollback y apagas | Viste el rollback y `npm run costos` no marca nada por hora |

> **Costo de hoy.** Por primera vez algo del proyecto cobra por hora: el balanceador (~0.03 USD por hora con sus direcciones IP) y las tareas (~0.015 cada una con la suya). La sesión completa cuesta unos 20 centavos por persona **si apagas al final**; olvidado un mes, unos 45 dólares por persona. El bloque E termina con `npm run apagar` y no es opcional.

## Antes de empezar

Hazlo al llegar, antes del repaso: el despliegue tarda unos minutos y corre solo.

```bash
# Mac
aws login --profile crediflow
git checkout main && git pull
git checkout a04-inicio -- infra/lib/stacks infra/bin     # trae el esqueleto de hoy
npm install
source ./scripts/mac/load-env.sh
npm run encender                                           # vuelve a crear Network, Data y Cicd: 3-4 minutos
```
```powershell
# Windows
aws login --profile crediflow
git checkout main; git pull
git checkout a04-inicio -- infra/lib/stacks infra/bin
npm install
. .\scripts\windows\load-env.ps1
npm run encender
```

Qué hizo la tercera línea: trajo a tu rama los archivos de `infra/lib/stacks` e `infra/bin` del punto de partida de hoy. Tus stacks de la sesión 3 quedan como la versión de referencia y aparece un esqueleto nuevo, `service-stack.ts`. Si el comando dice que no conoce `a04-inicio`, trae las etiquetas del repositorio del curso: `git fetch base --tags`.

Abre **Docker Desktop** y espera a que su ícono indique que está corriendo. Comprueba: `docker run --rm hello-world`.

## Bloque A · El contenedor en tu máquina (15 min)

### A1. Lee el Dockerfile

Abre `apps/api/Dockerfile` con la lámina "El Dockerfile de CrediFlow, línea por línea" a la vista. Responde con tu equipo: ¿por qué hay dos `FROM`? ¿Qué se queda fuera de la imagen final? ¿Por qué `USER node`? Si quieres contrastar, usa el prompt 4.1 de `docs/sesion-04/prompts.md`.

### A2. Construye y arranca

```bash
cd apps/api
docker build -t crediflow-api .
docker run --rm -p 3000:3000 -e STORAGE=memory crediflow-api
```

La primera construcción descarga la imagen base y tarda uno o dos minutos. `-p 3000:3000` publica el puerto del contenedor en tu máquina; `-e` le pasa una variable de entorno; `--rm` borra el contenedor al detenerlo. Verás el registro de arranque de la API, una línea JSON por evento.

### A3. Pregúntale y mídelo

En **otra terminal**:

```bash
curl -s localhost:3000/health          # Windows: Invoke-RestMethod http://localhost:3000/health
docker ps                              # columna STATUS: "Up … (healthy)"
docker stats --no-stream               # memoria y CPU que usa de verdad
docker images crediflow-api            # el tamaño de la imagen
```

`healthy` aparece gracias a la instrucción `HEALTHCHECK` del Dockerfile (tarda unos 15 segundos en la primera comprobación). Anota la memoria que usa el contenedor (unos 60 MiB) y compárala con los 512 MiB que pediremos en Fargate: hay margen de sobra.

Detén el contenedor con `Ctrl+C` en la primera terminal y vuelve a la raíz del repositorio (`cd ../..`).

Esta imagen, exactamente esta, es la que va a correr en AWS: no se instala nada al arrancar, a diferencia del servidor de la sesión 2.

✅ **Listo cuando:** la imagen se construyó, el contenedor respondió `/health` y `docker ps` lo mostró como *healthy*.

## Bloque B · El servicio como código, por el pipeline (30 min)

### B1. Completa `ServiceStack`

Abre `infra/lib/stacks/service-stack.ts` y reemplaza los `TODO` del constructor por:

```ts
this.api = new CrediFlowFargateService(this, 'Api', {
  vpc: props.network.vpc,
  serviceName: this.names.resource('api'),
  logGroupName: this.names.logGroup('api'),
  image: ecs.ContainerImage.fromAsset(apiPath, { platform: ecrAssets.Platform.LINUX_ARM64 }),
  containerPort: 3000,
  healthCheckPath: '/health',
  minCapacity: 2,
  maxCapacity: this.cfg.isProd ? 10 : 4,
  taskSubnets: props.network.workloadSubnets,           // públicas sin NAT; privadas con CF_NAT=true
  assignPublicIp: props.network.workloadsNeedPublicIp,
  removalPolicy: this.removalPolicy,
  accessLogsBucket: props.logsBucket.bucket,
  environment: {
    NODE_ENV: 'production',
    CF_STUDENT: this.cfg.student,
    CF_ENV: this.cfg.env,
    STORAGE: 'dynamo',
    TABLE_NAME: props.solicitudes.table.tableName,
    DOCUMENTS_BUCKET: props.documentsBucket.bucket.bucketName,
    ...(props.queue ? { QUEUE_URL: props.queue.queueUrl } : {}),
  },
});

// Mínimo privilegio: solo lo que la API necesita
props.solicitudes.table.grantReadWriteData(this.api.taskDefinition.taskRole);
props.documentsBucket.bucket.grantReadWrite(this.api.taskDefinition.taskRole);
props.queue?.grantSendMessages(this.api.taskDefinition.taskRole);

this.crossStackExport('ApiUrl', this.api.url, 'URL pública de la API de solicitudes');
this.crossStackExport('AlbArn', this.api.loadBalancer.loadBalancerArn);
this.publishParameter('ApiUrlParam', 'api-url', this.api.url);
```

Borra la línea `void apiPath; void ecs; void ecrAssets;` y, en la declaración de la clase, cambia `public readonly api!:` por `public readonly api:`.

Lee lo que escribiste:

- **La imagen** sale de `fromAsset`: CDK ejecuta `docker build` sobre `apps/api` y sube el resultado a ECR. Por eso Docker tiene que estar abierto al desplegar.
- **No hay contraseñas.** La API recibe el nombre de la tabla en una variable de entorno y habla con DynamoDB con el **rol de la tarea**. `grantReadWriteData` escribe por ti la política de IAM mínima, la que en la sesión 1 escribiste a mano.
- **`workloadSubnets` y `workloadsNeedPublicIp`** encapsulan la decisión de costo: sin NAT Gateway, las tareas van en subredes públicas con IP pública; con `CF_NAT=true`, en privadas.
- **Las líneas con `queue`** no hacen nada todavía: se activan en la sesión 5.

Abre también `infra/lib/constructs/crediflow-fargate-service.ts` y localiza cuatro cosas: el *circuit breaker* con rollback, el health check cada 15 segundos, el autoscaling por CPU (60 %) y por peticiones (200 por tarea), y `minHealthyPercent: 100`.

```bash
cd infra
npm test
npx cdk synth Service --quiet
npx cdk diff Service            # todo en verde [+]: un balanceador, un clúster, un servicio, roles, alarmas de autoscaling
cd ..
```

### B2. Despliega por el pipeline

```bash
git checkout -b feat/sesion-4-fargate
git add -A
git commit -m "feat: ServiceStack con ECS Fargate y ALB"
git push -u origin feat/sesion-4-fargate
gh pr create --fill
```

Espera el CI en verde, pide la revisión de un compañero y fusiona:

```bash
gh pr merge --squash --delete-branch
```

En **Actions**, el job *Desplegar a dev* construye la imagen y despliega el servicio. Tarda entre **12 y 15 minutos** (construir la imagen para ARM en el runner, crear el balanceador y esperar a que las dos tareas estén sanas). No esperes mirando: pasa a B3.

> **Plan B.** Si el job falla o el tiempo aprieta, despliega desde tu máquina con Docker abierto: `cd infra && npx cdk deploy Service` (unos 8 minutos). Diagnostica el job después con el prompt 3.4. Lo importante hoy es tener el servicio arriba.

### B3. Mientras despliega: RTO y RPO de CrediFlow (en equipo)

Una persona copia la plantilla y la comparte:

```bash
cp docs/plantillas/rto-rpo.md docs/sesion-04/rto-rpo-<equipo>.md
```

Completen las secciones 1 y 2: ¿cuánto tiempo puede estar caída la recepción de solicitudes?, ¿cuántos minutos de solicitudes se pueden perder?, ¿y la precalificación? Escriban un objetivo y una justificación de negocio para cada componente. Para contrastar, usen el prompt 4.3. La sección 3 ("qué tenemos hoy") se llena con mediciones reales en los bloques D y E.

✅ **Listo cuando:** el job de dev terminó en verde (o desplegaste con el plan B) y el documento tiene objetivos propuestos. Ahora, **receso de 10 minutos**.

## Bloque C · Verificar el servicio (10 min)

### C1. La dirección del balanceador

```bash
# Mac
git checkout main && git pull
export API_URL=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/api-url --query Parameter.Value --output text)
echo $API_URL
curl -s $API_URL/health
```
```powershell
# Windows
git checkout main; git pull
$env:API_URL = aws ssm get-parameter --name "/crediflow/$env:CF_STUDENT/dev/api-url" --query Parameter.Value --output text
$env:API_URL
Invoke-RestMethod "$env:API_URL/health"
```

Respuesta esperada: `{"status":"ok","storage":"dynamo","database":"ok","queue":"not-configured",...}`.

### C2. Dos copias, dos zonas

Llama a `/info` varias veces y fíjate en el campo `hostname`:

```bash
for i in 1 2 3 4 5 6; do curl -s $API_URL/info | node -pe 'JSON.parse(require("fs").readFileSync(0)).hostname'; done
```
```powershell
1..6 | ForEach-Object { (Invoke-RestMethod "$env:API_URL/info").hostname }
```

Aparecen **dos nombres distintos**: el balanceador reparte entre dos tareas. Míralas:

```bash
# Mac
export CLUSTER=crediflow-$CF_STUDENT-dev-api-cluster
export SERVICIO=crediflow-$CF_STUDENT-dev-api
aws ecs describe-services --cluster $CLUSTER --services $SERVICIO --query 'services[0].[status,desiredCount,runningCount,deployments[0].rolloutState]'
aws ecs describe-tasks --cluster $CLUSTER --tasks $(aws ecs list-tasks --cluster $CLUSTER --query taskArns --output text) --query 'tasks[].[availabilityZone,lastStatus,healthStatus]' --output table
```
```powershell
# Windows
$env:CLUSTER = "crediflow-$env:CF_STUDENT-dev-api-cluster"
$env:SERVICIO = "crediflow-$env:CF_STUDENT-dev-api"
aws ecs describe-services --cluster $env:CLUSTER --services $env:SERVICIO --query 'services[0].[status,desiredCount,runningCount,deployments[0].rolloutState]'
$tareas = (aws ecs list-tasks --cluster $env:CLUSTER --query taskArns --output text) -split '\s+'
aws ecs describe-tasks --cluster $env:CLUSTER --tasks $tareas --query 'tasks[].[availabilityZone,lastStatus,healthStatus]' --output table
```

Dos tareas, en dos zonas distintas. En la consola: **ECS → Clusters → tu clúster → tu servicio**: pestañas **Tasks**, **Health and metrics** y **Deployments**. Y **EC2 → Target Groups**: dos destinos en estado *healthy*.

### C3. Datos y frontend

```bash
# Mac
curl -s -X POST $API_URL/solicitudes -H "Content-Type: application/json" \
  -d '{"nombre":"Ana Pérez","documento":"01234567-8","monto":5000,"plazoMeses":24,"ingresoMensual":1200,"proposito":"consumo"}'
./scripts/mac/web-env.sh && (cd apps/web && npm run dev)
```
```powershell
# Windows
Invoke-RestMethod -Method Post -Uri "$env:API_URL/solicitudes" -ContentType "application/json" `
  -Body '{"nombre":"Ana Pérez","documento":"01234567-8","monto":5000,"plazoMeses":24,"ingresoMensual":1200,"proposito":"consumo"}'
.\scripts\windows\web-env.ps1; cd apps\web; npm run dev
```

`web-env` lee la dirección de tu API desde Parameter Store y la escribe en `apps/web/.env.local`: ya no copias direcciones a mano. Abre `http://localhost:3001`: **Estado** en verde con `env: dev` y el identificador de una tarea como host. Crea una solicitud desde la web y búscala en la consola: **DynamoDB → tu tabla `tbl-solicitudes` → Explore table items**. Detén la web con `Ctrl+C` y vuelve a la raíz.

✅ **Listo cuando:** `/info` alterna entre dos tareas, las dos están en zonas distintas y la web muestra tu backend en verde.

## Bloque D · Matar una tarea y cargar el servicio (20 min)

### D1. Autorreparación

En una terminal, vigila `/health` una vez por segundo:

```bash
# Terminal 1 (Mac)
while true; do curl -s -o /dev/null -w "%{http_code} " $API_URL/health; sleep 1; done
```
```powershell
# Terminal 1 (Windows)
while ($true) { try { Write-Host -NoNewline "$((Invoke-WebRequest "$env:API_URL/health" -UseBasicParsing).StatusCode) " } catch { Write-Host -NoNewline "ERR " }; Start-Sleep 1 }
```

En otra terminal (carga el entorno y las variables `CLUSTER` y `SERVICIO` de C2), mata una tarea a propósito y mira qué hace el servicio:

```bash
# Terminal 2 (Mac)
TAREA=$(aws ecs list-tasks --cluster $CLUSTER --query 'taskArns[0]' --output text)
aws ecs stop-task --cluster $CLUSTER --task $TAREA --reason "prueba de autorreparacion" --query 'task.stoppedReason'
aws ecs describe-services --cluster $CLUSTER --services $SERVICIO --query 'services[0].events[0:5].message'
```
```powershell
# Terminal 2 (Windows)
$TAREA = aws ecs list-tasks --cluster $env:CLUSTER --query 'taskArns[0]' --output text
aws ecs stop-task --cluster $env:CLUSTER --task $TAREA --reason "prueba de autorreparacion" --query 'task.stoppedReason'
aws ecs describe-services --cluster $env:CLUSTER --services $env:SERVICIO --query 'services[0].events[0:5].message'
```

La terminal 1 debe seguir imprimiendo `200`: la otra tarea atendió todo. Repite el último comando cada medio minuto y lee los eventos: el servicio detecta que tiene una tarea menos de las deseadas, lanza otra, la registra en el balanceador y vuelve al estado estable. **Mide el tiempo** desde que mataste la tarea hasta que hay otra vez dos sanas y anótalo en la sección 3 del documento RTO/RPO: es tu tiempo real de recuperación ante la falla de una copia.

Recuerda la pregunta de la sesión 2: "¿qué pasa si el servidor se apaga a las 2 a.m.?" Esta es la respuesta.

### D2. Prueba de carga y autoscaling

Deja el vigilante de la terminal 1 y lanza 30 clientes concurrentes durante 3 minutos:

```bash
node scripts/load/carga.js $API_URL 180 30          # Windows: node scripts\load\carga.js $env:API_URL 180 30
```

Mientras corre, en otra terminal o en la consola (**ECS → tu servicio → Health and metrics**, y la pestaña **Tasks**):

```bash
# Mac
aws application-autoscaling describe-scaling-activities --service-namespace ecs --resource-id service/$CLUSTER/$SERVICIO --query 'ScalingActivities[0:4].[StartTime,Description,StatusCode]' --output table
aws ecs describe-services --cluster $CLUSTER --services $SERVICIO --query 'services[0].[desiredCount,runningCount]'
```
```powershell
# Windows
aws application-autoscaling describe-scaling-activities --service-namespace ecs --resource-id "service/$env:CLUSTER/$env:SERVICIO" --query 'ScalingActivities[0:4].[StartTime,Description,StatusCode]' --output table
aws ecs describe-services --cluster $env:CLUSTER --services $env:SERVICIO --query 'services[0].[desiredCount,runningCount]'
```

En uno a tres minutos, `desiredCount` pasa de 2 a 3 o 4: la capacidad siguió a la demanda. Al terminar, `carga.js` imprime el resumen: solicitudes correctas, errores y latencias p50, p95 y p99. Anótalas. Si quieres interpretarlas, pega el resumen en el prompt 4.2: ¿qué significa que p95 sea mucho mayor que p50? ¿Dónde estaría el cuello de botella?

Mira también **DynamoDB → tu tabla → Monitor**: miles de escrituras sin configurar nada y sin limitaciones (*throttling*). El costo de toda la prueba: centavos. El servicio volverá a 2 tareas por sí solo unos 15 minutos después de que baje la carga.

✅ **Listo cuando:** `/health` no falló mientras matabas una tarea, mediste el tiempo de recuperación y viste al servicio crecer por encima de 2 tareas.

## Bloque E · Romper un despliegue, ver el rollback y apagar (25 min)

### E1. Una versión rota

La API trae un interruptor para simular un despliegue defectuoso: con la variable `FAIL_HEALTH=true`, `/health` responde 500. En `service-stack.ts`, dentro de `environment`, agrega:

```ts
FAIL_HEALTH: 'true',
```

Deja el vigilante de `/health` corriendo en la terminal 1 y despliega **desde tu máquina**, para verlo en vivo (en la vida real sería un pull request):

```bash
cd infra
npx cdk deploy Service
```

### E2. Mira cómo se deshace solo

Mientras el comando espera, en la consola: **ECS → tu servicio → Deployments**. Verás dos despliegues a la vez: el anterior, con sus dos tareas sanas, y el nuevo, cuyas tareas arrancan, no superan el health check del balanceador y se detienen. Tras varios intentos, el estado del nuevo pasa a *Failed* y el servicio vuelve a la revisión anterior. Por CLI:

```bash
aws ecs describe-services --cluster $CLUSTER --services $SERVICIO --query 'services[0].deployments[].[status,rolloutState,rolloutStateReason]'          # Windows: $env:CLUSTER, $env:SERVICIO
```

Tarda entre **8 y 12 minutos**: el *circuit breaker* es prudente antes de declarar el fallo. Al final, `cdk deploy` termina con error y CloudFormation deshace también el cambio del stack (`UPDATE_ROLLBACK_COMPLETE`).

Y ahora mira la terminal 1: **siguió imprimiendo 200 todo el tiempo**. Los usuarios nunca vieron la versión rota. Anota en el documento RTO/RPO cuánto tardó el sistema en volver solo a un estado estable.

Mientras esperas, completa la sección 4 del documento (mejoras y su costo) y, si quieres reconstruir la secuencia de hechos, usa el prompt 4.4 con los eventos del servicio.

Cuando termine, **quita la línea `FAIL_HEALTH`** (o `git checkout -- lib/stacks/service-stack.ts`) y comprueba que no queda nada pendiente: `npx cdk diff Service` debe decir que no hay diferencias.

### E3. Entrega el documento y apaga

```bash
cd ..
git checkout -b docs/rto-rpo && git add docs/sesion-04 && git commit -m "docs: RTO y RPO del equipo" && git push -u origin docs/rto-rpo
```

(Una sola persona del equipo sube el documento. No lo fusiones todavía: si lo haces con todo apagado, el despliegue fallará por falta del rol; lo fusionarás en la sesión 5, en el bloque E, con todo encendido.)

Ahora, lo que no es opcional:

```bash
git checkout main
npm run apagar          # cdk destroy --all: unos 10 minutos; el balanceador es lo que más tarda
npm run costos          # no debe marcar nada "por hora"
```

No cierres la laptop con el apagado a medias. Si `npm run costos` todavía marca el balanceador o el servicio, espera un par de minutos y repite.

✅ **Listo cuando:** viste el despliegue fallar y deshacerse solo sin que `/health` dejara de responder, y `npm run costos` no marca ningún recurso por hora.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop no está abierto. Ábrelo y espera a que termine de arrancar |
| `docker build` muy lento en Windows | La imagen es ARM y tu procesador x86: Docker la emula. Es normal; la segunda vez usa caché |
| `exec format error` al construir | Falta la emulación de ARM: ejecuta una vez `docker run --privileged --rm tonistiigi/binfmt --install arm64` y repite |
| `git checkout a04-inicio` no reconoce la etiqueta | `git fetch base --tags` |
| El job de dev falla en `cdk deploy` con `no basic auth credentials` o al construir | Relanza el job (*Re-run*); si persiste, usa el plan B y avisa al instructor |
| El job de dev falla: rol no encontrado | Olvidaste `npm run encender` al llegar: el rol de GitHub estaba apagado |
| `/health` responde 503 `Service Temporarily Unavailable` | Las tareas aún no pasan el health check: espera un minuto. Si sigue, revisa los logs: `aws logs tail /crediflow/<tu usuario>/dev/api --since 10m` |
| `/health` responde `"database":"unavailable"` | El rol de la tarea no tiene permiso sobre la tabla: revisa `grantReadWriteData` en tu stack |
| El servicio no escala con la carga | Sube la concurrencia (`… 180 60`) o espera: el autoscaling tarda de 1 a 3 minutos en reaccionar |
| `cdk deploy` del bloque E "se queda colgado" | Es el circuit breaker trabajando: de 8 a 12 minutos. No lo canceles |
| `npm run apagar` falla en un stack | Repite el comando; si un bucket no se vacía, avisa al instructor |

## Cierre

### Checklist de verificación (por equipo)

Marca cada punto solo cuando **todos** los integrantes lo hayan completado.

- [ ] Construí la imagen localmente, respondió `/health` y puedo explicar las dos etapas del Dockerfile y por qué corre como `node`
- [ ] `ServiceStack` desplegado por el pipeline (o desde mi máquina, con el motivo anotado)
- [ ] Dos tareas en dos zonas distintas; balanceador con dos destinos *healthy*
- [ ] Sé por qué las tareas tienen IP pública (sin NAT Gateway, decisión de costo) y qué las protege (su security group solo acepta al balanceador)
- [ ] La API escribe en DynamoDB con el rol de la tarea, sin contraseñas; vi los ítems en la consola
- [ ] Frontend conectado con `web-env`, mostrando `env: dev`
- [ ] Autorreparación: detuve una tarea, `/health` no falló y anoté el tiempo de recuperación: ____ s
- [ ] Carga: p50 ____ ms, p95 ____ ms; el servicio escaló a ____ tareas
- [ ] Rollback: el despliegue con `FAIL_HEALTH` se deshizo solo y la API no dejó de responder; tiempo: ____ min
- [ ] Documento `rto-rpo-<equipo>.md` con objetivos justificados, dos valores medidos y el costo de mejorarlos
- [ ] Podemos explicar por qué una aplicación **sin estado** es requisito para escalar en horizontal
- [ ] **`npm run apagar` terminado y `npm run costos` sin recursos por hora**

### Para la sesión 5

- Lee `apps/precalificacion/src/motor.ts` (la regla de negocio de la precalificación) y `apps/worker/src/evaluador.ts` (el proceso que evalúa las solicitudes).
- Ten a mano el correo que pusiste en `CF_ALERT_EMAIL`: la próxima semana recibirá notificaciones y habrá que confirmar una suscripción.
- Dudas al canal del curso.

### Reto para casa (opcional, 30-45 min, sin costo)

**Objetivo.** Hacer la imagen de la API más pequeña y con menos vulnerabilidades, sin cambiar su comportamiento. Todo ocurre en tu máquina con Docker: no hay que desplegar nada.

**Cómo.** Mide el punto de partida:

```bash
cd apps/api
docker build -t crediflow-api:antes .
docker images crediflow-api
docker scout quickview crediflow-api:antes        # viene con Docker Desktop; alternativa: trivy image crediflow-api:antes
```

Prueba mejoras en una copia del Dockerfile (por ejemplo `Dockerfile.reto`) y construye con `docker build -f Dockerfile.reto -t crediflow-api:despues .`. Ideas, de menor a mayor esfuerzo:

1. Un archivo `.dockerignore` que excluya `node_modules`, `dist` y las pruebas del contexto de construcción.
2. `npm ci` en lugar de `npm install` (requiere copiar también `package-lock.json`; en este repositorio el *lock* está en la raíz del monorepo: ¿cómo lo resolverías?).
3. Una imagen final *distroless*: `FROM gcr.io/distroless/nodejs22-debian12` en la segunda etapa, con `CMD ["dist/server.js"]`.

**Cómo comprobar.** La imagen nueva debe seguir respondiendo:

```bash
docker run --rm -p 3000:3000 -e STORAGE=memory crediflow-api:despues
curl -s localhost:3000/health
```

Compara tamaño y vulnerabilidades críticas y altas, antes y después. Con *distroless* notarás que el `HEALTHCHECK` del Dockerfile deja de funcionar: no hay `wget` ni shell dentro de la imagen. ¿Importa en AWS? (Pista: ¿quién comprueba la salud de las tareas en Fargate?)

**Qué entregas.** En el canal del curso: una tabla con el antes y el después (megabytes y vulnerabilidades), tu Dockerfile y una frase sobre qué mejora dio más resultado. Si usaste IA, cuenta qué le pediste y qué tuviste que corregir.

**Bonus.** Agrega al workflow de CI un paso que escanee la imagen y falle si hay vulnerabilidades críticas. ¿En qué momento del pipeline lo pondrías?
