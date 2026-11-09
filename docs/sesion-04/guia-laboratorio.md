# Sesión 4 · Laboratorio: la API en contenedores con ECS Fargate, ALB, autoscaling y rollback

**Duración:** 110 min · **Entregable:** `ServiceStack` desplegado por el pipeline; pruebas de autorreparación, carga y rollback realizadas; documento RTO/RPO del equipo.

**Punto de partida:** `git checkout a04-inicio`. Requiere Docker Desktop abierto.

> **Costo.** Hoy aparecen los dos recursos que cobran por hora: el ALB (~0.025 USD/h) y las tareas Fargate (~0.01 USD/h cada una). Toda la sesión cuesta ~0.20 USD por alumno **si al final ejecutas `npm run apagar`**. Las tareas corren en subredes públicas con IP pública porque no hay NAT Gateway (~32 USD/mes): el security group solo admite tráfico del ALB.

Al llegar: `npm run encender` si apagaste al final de la sesión 3 (3-4 min).

---

## Parte A · El contenedor en tu máquina (15 min)

### A1. Leer el Dockerfile

Abre `apps/api/Dockerfile` y usa el **prompt 4.1**. Preguntas clave: ¿por qué dos etapas? ¿por qué `USER node`? ¿qué hace `HEALTHCHECK`?

### A2. Construir y correr

```bash
cd apps/api
docker build -t crediflow-api .
docker run --rm -p 3000:3000 -e STORAGE=memory crediflow-api
```

En otra terminal:

```bash
curl -s localhost:3000/health
docker ps                     # el contenedor, su puerto y el estado del HEALTHCHECK
docker stats --no-stream      # memoria y CPU: compara con los 512 MiB que pediremos en Fargate
```

Detén con `Ctrl+C`. Mira el tamaño de la imagen: `docker images crediflow-api`.

✅ **Checkpoint A:** la imagen corre localmente y responde `/health`.

---

## Parte B · ServiceStack (20 min)

Abre `infra/lib/stacks/service-stack.ts` y completa el esqueleto:

```ts
this.api = new CrediFlowFargateService(this, 'Api', {
  vpc: props.network.vpc,
  serviceName: this.names.resource('api'),
  logGroupName: this.names.logGroup('api'),
  image: ecs.ContainerImage.fromAsset(path.join(__dirname, '..', '..', '..', 'apps', 'api'), {
    platform: ecrAssets.Platform.LINUX_ARM64,
  }),
  containerPort: 3000,
  healthCheckPath: '/health',
  minCapacity: 2,
  maxCapacity: this.cfg.isProd ? 10 : 4,
  taskSubnets: props.network.workloadSubnets,          // públicas sin NAT; privadas con CF_NAT=true
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
  },
});

props.solicitudes.table.grantReadWriteData(this.api.taskDefinition.taskRole);
props.documentsBucket.bucket.grantReadWrite(this.api.taskDefinition.taskRole);

this.crossStackExport('ApiUrl', this.api.url);
this.crossStackExport('AlbArn', this.api.loadBalancer.loadBalancerArn);
this.publishParameter('ApiUrlParam', 'api-url', this.api.url);
```

Observa: la imagen viene de `fromAsset` (CDK la construye con Docker y la sube a ECR); **no hay contraseñas**: la API habla con DynamoDB con el rol de la tarea y `grantReadWriteData` genera la política IAM mínima; `workloadSubnets` y `workloadsNeedPublicIp` encapsulan la decisión de costo (sin NAT → subredes públicas con IP pública).

```bash
cd infra && npm test && npx cdk synth Service --quiet
```

Abre `constructs/crediflow-fargate-service.ts`: circuit breaker, autoscaling por CPU y por solicitudes, health check cada 15 s, 2 tareas mínimo en 2 AZ.

### B1. Desplegar por el pipeline

```bash
git checkout -b feat/sesion-4-fargate
git add -A && git commit -m "feat: ServiceStack con ECS Fargate y ALB"
git push -u origin feat/sesion-4-fargate && gh pr create --fill
```

CI verde → revisión → `gh pr merge --squash --delete-branch` → el job `dev` construye la imagen en el runner y despliega (**10-12 min**). Mientras, parte C.

> Plan B si el pipeline falla por tiempo: `npx cdk deploy Service` desde tu máquina (con Docker abierto). Diagnostica el job después con el prompt 3.4.

---

## Parte C · Mientras despliega: RTO y RPO de CrediFlow (15 min, en equipo)

Copia `docs/plantillas/rto-rpo.md` a `docs/sesion-04/rto-rpo-<equipo>.md` y complétalo. Usa el **prompt 4.3** para contrastar. Preguntas guía: ¿cuánto tiempo puede estar caída la recepción de solicitudes? ¿cuántos minutos de solicitudes se pueden perder? ¿qué cuesta cada minuto de mejora?

---

## 🔁 Receso (10 min)

---

## Parte D · Verificar el servicio (10 min)

```bash
# Mac
export API_URL=$(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/api-url --query Parameter.Value --output text)
curl -s $API_URL/health; curl -s $API_URL/info
```
```powershell
# Windows
$env:API_URL = aws ssm get-parameter --name "/crediflow/$env:CF_STUDENT/dev/api-url" --query Parameter.Value --output text
Invoke-RestMethod "$env:API_URL/health"; Invoke-RestMethod "$env:API_URL/info"
```

Respuesta esperada de `/health`: `{"status":"ok","storage":"dynamo","database":"ok",...}`.

Llama `/info` varias veces: el `hostname` cambia porque el ALB balancea entre **dos tareas**.

```bash
aws ecs describe-services --cluster crediflow-$CF_STUDENT-dev-api-cluster --services crediflow-$CF_STUDENT-dev-api \
  --query 'services[0].[status,desiredCount,runningCount,deployments[0].rolloutState]'
aws ecs list-tasks --cluster crediflow-$CF_STUDENT-dev-api-cluster --query taskArns --output text | \
  xargs aws ecs describe-tasks --cluster crediflow-$CF_STUDENT-dev-api-cluster --tasks --query 'tasks[].[availabilityZone,lastStatus,healthStatus]' --output table
```
(Windows: reemplaza `$CF_STUDENT` por `$env:CF_STUDENT`; para el segundo comando copia los ARNs a mano.)

En la consola: ECS → Clusters → servicio → **Tasks** (2 AZ distintas), **Health and metrics**, **Deployments**. EC2 → Load Balancers → *Target groups* → 2 targets `healthy`. Crea una solicitud y mírala en DynamoDB → tabla `tbl-solicitudes` → **Explore items**.

Conecta el frontend a tu backend en AWS:

```bash
./scripts/mac/web-env.sh && cd apps/web && npm run dev      # Windows: .\scripts\windows\web-env.ps1
```

**Estado** en verde con `env: dev`, host = ID de la tarea. Crea una solicitud.

---

## Parte E · Prueba de autorreparación (10 min)

Mata una tarea a propósito y observa que el servicio no cae:

```bash
# Terminal 1: vigila /health cada segundo
while true; do curl -s -o /dev/null -w "%{http_code} " $API_URL/health; sleep 1; done
```
```powershell
# Terminal 1 (Windows)
while ($true) { try { (Invoke-WebRequest "$env:API_URL/health" -UseBasicParsing).StatusCode } catch { "ERR" }; Start-Sleep 1 }
```

```bash
# Terminal 2: detener una tarea
TASK=$(aws ecs list-tasks --cluster crediflow-$CF_STUDENT-dev-api-cluster --query 'taskArns[0]' --output text)
aws ecs stop-task --cluster crediflow-$CF_STUDENT-dev-api-cluster --task $TASK --reason "prueba de autorreparación"
aws ecs describe-services --cluster crediflow-$CF_STUDENT-dev-api-cluster --services crediflow-$CF_STUDENT-dev-api --query 'services[0].events[0:5].message'
```

La terminal 1 debe seguir en `200`. Anota cuánto tarda ECS en volver a 2 tareas sanas (**ese es tu RTO real para una falla de tarea**).

---

## Parte F · Prueba de carga y autoscaling (15 min)

```bash
node scripts/load/carga.js $API_URL 180 30        # 3 min, 30 workers
```
(Windows: `node scripts\load\carga.js $env:API_URL 180 30`)

En paralelo:

```bash
aws application-autoscaling describe-scaling-activities --service-namespace ecs \
  --resource-id service/crediflow-$CF_STUDENT-dev-api-cluster/crediflow-$CF_STUDENT-dev-api --query 'ScalingActivities[0:5].[StartTime,Description,StatusCode]' --output table
```

Consola: ECS → servicio → **Health and metrics** (CPU) y Auto Scaling → actividades. Verás el servicio subir a 3-4 tareas. Al terminar la carga, bajará (cooldown 60 s + evaluación).

Pega el resumen de latencias en el **prompt 4.2** con Claude: ¿qué significa p95 vs p50? ¿dónde está el cuello de botella (CPU de la API, DynamoDB, ALB)? Revisa en DynamoDB → tabla → **Monitor** las unidades consumidas: bajo demanda, sin throttling, y el costo de la prueba son centavos.

---

## Parte G · Despliegue roto y rollback automático (15 min)

Simula un despliegue defectuoso: en `ServiceStack`, dentro de `environment`, agrega `FAIL_HEALTH: 'true'`. Con eso `/health` devuelve 500 y las tareas nuevas nunca pasan el health check.

```bash
cd infra && npx cdk deploy Service      # hoy, local para verlo en vivo (en la vida real: por PR)
```

Observa en la consola ECS → **Deployments**: la nueva revisión intenta arrancar, falla el health check, y el **circuit breaker** hace **rollback** a la revisión anterior. Mientras tanto, la terminal con el bucle `/health` siguió en `200`: **los usuarios nunca vieron el error**.

```bash
aws ecs describe-services --cluster crediflow-$CF_STUDENT-dev-api-cluster --services crediflow-$CF_STUDENT-dev-api --query 'services[0].deployments[].[status,rolloutState,rolloutStateReason]'
```

Quita `FAIL_HEALTH` y despliega de nuevo (o simplemente `git checkout -- .` si no hiciste commit).

✅ **Checkpoint G:** viste `ROLLBACK` en `rolloutState` y la API nunca dejó de responder.

---

## Cierre (10 min)

1. [Checklist](checklist.md).
2. **`npm run apagar`**: el ALB y las tareas cobran por hora. Verifica con `npm run costos` que no quede nada "por hora".
3. Entrega `rto-rpo-<equipo>.md` en tu repo (PR pequeño).
3. Trabajo asíncrono: [reto](reto.md). Leer `apps/precalificacion/src/motor.ts` y `apps/worker/src/evaluador.ts` para la sesión 5.
