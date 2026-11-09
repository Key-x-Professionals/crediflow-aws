# Sesión 3 · Laboratorio: la infraestructura como código con CDK y un pipeline sin llaves

**Duración:** 110 min · **Entregable:** tu repositorio GitHub con `NetworkStack`, `DataStack` y `CicdStack` desplegados; pruebas pasando; pipeline PR → dev → prod con OIDC.

> **Costo.** Desde hoy, cada sesión empieza con `npm run encender` (cuando ya existan stacks) y termina con `npm run apagar`. Lo de hoy (VPC sin NAT, DynamoDB, buckets, rol) no tiene costo por hora, pero apagar al final es el hábito que protege el crédito de la cuenta. Ver [costos.md](../00-preparacion/costos.md).

**Punto de partida:** `git checkout a03-inicio` (si vienes de la sesión 2 ya estás ahí).

Prepara la terminal con `source ./scripts/mac/load-env.sh` (Mac) o `. .\scripts\windows\load-env.ps1` (Windows) y `aws login --profile crediflow` si la sesión expiró.

---

## Parte A · Bootstrap y tour del proyecto CDK (15 min)

### A1. ¿La cuenta ya tiene bootstrap?

El bootstrap de CDK se hace **una vez por cuenta y región** (lo hizo el instructor). Verifica:

```bash
aws cloudformation describe-stacks --stack-name CDKToolkit --query 'Stacks[0].StackStatus'
```

Si no existiera: `npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/$CDK_DEFAULT_REGION` (Windows: `aws://$env:CDK_DEFAULT_ACCOUNT/$env:CDK_DEFAULT_REGION`).

### A2. Tour guiado (lee, no escribas aún)

| Archivo | Qué resuelve |
|---|---|
| `infra/lib/config.ts` | Lee tu `.env` y valida `CF_STUDENT`. |
| `infra/lib/naming.ts` | `names.resource('api')` → `crediflow-<alumno>-dev-api`; `arns.sqsQueue(...)`. |
| `infra/lib/crediflow-stack.ts` | Clase base: nombre del stack, etiquetas, `crossStackExport`, `publishParameter`. |
| `infra/lib/constructs/` | Bloques listos: `CrediFlowVpc`, `SecureBucket`, `CrediFlowTable`, `CrediFlowFargateService`, ... |
| `infra/lib/stacks/` | Un stack por sesión. **Aquí trabajas tú.** |
| `infra/bin/crediflow.ts` | Instancia los stacks y los conecta. |

```bash
cd infra
npx cdk ls                        # lista los stacks (ya con tu nombre de alumno)
```

Compara `constructs/crediflow-vpc.ts` con `paso_red` del script manual de la sesión 2: las mismas decisiones, escritas una vez.

---

## Parte B · NetworkStack (20 min)

Abre `infra/lib/stacks/network-stack.ts`. Tiene un esqueleto con `TODO`. Complétalo:

```ts
this.network = new CrediFlowVpc(this, 'Network', {
  vpcName: this.names.resource('vpc'),
  natGateways: this.cfg.natGateways,   // 0 por defecto: sin costo fijo
  removalPolicy: this.removalPolicy,
});

this.crossStackExport('VpcId', this.network.vpc.vpcId, 'ID del VPC de CrediFlow');
this.publishParameter('VpcIdParam', 'vpc-id', this.network.vpc.vpcId);
```

### B1. Sintetizar y leer la plantilla

```bash
npx cdk synth Network --quiet
# Mac
grep -c '"Type": "AWS::' cdk.out/Network.template.json
# Windows
(Select-String -Path cdk.out\Network.template.json -Pattern '"Type": "AWS::').Count
```

Unas 10 líneas de TypeScript generaron ~30 recursos de CloudFormation. Usa el **prompt 3.1** para que Claude te explique 5 de ellos que no esperabas (flow logs, endpoints gateway, rutas). Fíjate en lo que **no** hay: NAT Gateway. Es una decisión de costo (~32 USD/mes) explicada en el construct; con `CF_NAT=true` aparece.

### B2. Desplegar y verificar

```bash
npx cdk deploy Network
```

Por CLI:

```bash
aws cloudformation describe-stack-resources --stack-name CrediFlow-$CF_STUDENT-dev-Network --query 'StackResources[].[ResourceType,PhysicalResourceId]' --output table
aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/vpc-id --query Parameter.Value --output text
```

En la consola: CloudFormation → stack → **Resources** y **Events**; VPC → *Resource map* (compara con el VPC manual de la sesión 2: ahora hay subredes aisladas, endpoints gateway y flow logs).

### B3. Un cambio y un `diff`

Cambia `cidr: '10.2.0.0/16'` en el stack, ejecuta `npx cdk diff Network` y **no despliegues**. Lee el diff con el **prompt 3.3**: ¿qué se reemplaza? ¿Qué se destruiría? Revierte el cambio.

✅ **Checkpoint B:** stack `Network` en `CREATE_COMPLETE` y entiendes el diff de un cambio destructivo.

---

## Parte C · DataStack (20 min)

En la sesión 2 la base de datos fue PostgreSQL en RDS. Desde hoy CrediFlow guarda las solicitudes en **DynamoDB**: no tiene costo por hora, no necesita VPC ni secretos, escala solo y 25 GB son siempre gratis. Es una decisión de costo y operación para el curso (RDS sigue siendo la opción natural cuando el modelo es relacional y hay presupuesto).

Abre `infra/lib/stacks/data-stack.ts` y completa:

```ts
this.logsBucket = new SecureBucket(this, 'LogsBucket', {
  bucketName: this.names.bucket('logs'),
  removalPolicy: this.removalPolicy,
  noncurrentVersionExpirationDays: 7,
});

this.documentsBucket = new SecureBucket(this, 'DocumentsBucket', {
  bucketName: this.names.bucket('documentos'),
  removalPolicy: this.removalPolicy,
  serverAccessLogsBucket: this.logsBucket.bucket,
});

this.solicitudes = new CrediFlowTable(this, 'Solicitudes', {
  tableName: this.names.table('solicitudes'),
  partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
  pointInTimeRecovery: this.cfg.isProd,
  removalPolicy: this.removalPolicy,
  globalSecondaryIndexes: [
    { indexName: 'porFecha',  partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING }, sortKey: { name: 'creadaEn', type: dynamodb.AttributeType.STRING } },
    { indexName: 'porEstado', partitionKey: { name: 'estado', type: dynamodb.AttributeType.STRING }, sortKey: { name: 'creadaEn', type: dynamodb.AttributeType.STRING } },
  ],
});

this.crossStackExport('SolicitudesTableName', this.solicitudes.table.tableName);
this.crossStackExport('DocumentsBucketName', this.documentsBucket.bucket.bucketName);
this.publishParameter('SolicitudesTableParam', 'solicitudes-table', this.solicitudes.table.tableName);
this.publishParameter('DocsBucketParam', 'documents-bucket', this.documentsBucket.bucket.bucketName);
```

¿Por qué dos índices? La API lista "las últimas solicitudes" (índice `porFecha`, con la clave fija `SOLICITUD` ordenada por fecha) y en la sesión 6 el dashboard pregunta "cuántas RECHAZADAS hoy" (índice `porEstado`). En DynamoDB se diseña a partir de las preguntas, no de las tablas (lo profundizamos en la sesión 5).

En `infra/bin/crediflow.ts` descomenta la línea de `DataStack` (TODO parte C).

```bash
npx cdk diff Data
npx cdk deploy Data --require-approval never    # ~1 min
```

Compara con la sesión 2: la tabla aparece en segundos y no hay contraseña que guardar en ningún lado; el acceso será por rol IAM (sesión 4).

---

## Parte D · Pruebas de infraestructura (10 min)

```bash
npm test                      # desde infra/
```

Abre `test/data-stack.test.ts`. Agrega una prueba: *la tabla no activa PITR en dev (tiene costo por GB)*:

```ts
it('no activa point-in-time recovery en dev', () => {
  template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
    Replicas: [{ PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: false } }],
  });
});
```

Usa el **prompt 3.2** para proponer dos pruebas más y elige una. Las pruebas corren en el pipeline (parte F) **antes** de desplegar.

---

## 🔁 Receso (10 min)

---

## Parte E · Verificar DataStack (5 min)

```bash
aws dynamodb describe-table --table-name crediflow-$CF_STUDENT-dev-tbl-solicitudes --query 'Table.[TableStatus,BillingModeSummary.BillingMode,GlobalSecondaryIndexes[].IndexName]'
aws dynamodb put-item --table-name crediflow-$CF_STUDENT-dev-tbl-solicitudes --item '{"id":{"S":"prueba-1"},"gsi1pk":{"S":"SOLICITUD"},"creadaEn":{"S":"2026-01-01T00:00:00Z"},"estado":{"S":"RECIBIDA"},"nombre":{"S":"Prueba"}}'
aws dynamodb query --table-name crediflow-$CF_STUDENT-dev-tbl-solicitudes --index-name porFecha --key-condition-expression 'gsi1pk = :p' --expression-attribute-values '{":p":{"S":"SOLICITUD"}}' --query 'Items[].id.S'
aws dynamodb delete-item --table-name crediflow-$CF_STUDENT-dev-tbl-solicitudes --key '{"id":{"S":"prueba-1"}}'
aws s3api get-bucket-encryption --bucket $(aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/documents-bucket --query Parameter.Value --output text)
```
(Windows: usa `$env:CF_STUDENT` y escapa las comillas del JSON con `\"` o guarda los JSON en archivos y usa `file://`.)

En la consola: CloudFormation → **Exports** (los valores `crediflow-<alumno>-dev:*`); DynamoDB → tabla → **Explore items**.

---

## Parte F · Git, GitHub y pipeline con OIDC (35 min)

### F1. Tu propio repositorio

Hasta hoy clonaste el repo base. Desde ahora trabajas en **tu** repositorio:

```bash
cd ..                                            # raíz del monorepo
git remote rename origin base
gh auth login                                    # una vez
gh repo create crediflow --private --source=. --remote=origin --push
```

Sin `gh`: crea el repo vacío en github.com y `git remote add origin git@github.com:<usuario>/crediflow.git && git push -u origin main --tags`.

Actualiza `CF_GITHUB_REPO=<usuario>/crediflow` en `.env`.

### F2. CicdStack: el rol que GitHub asumirá

Abre `infra/lib/stacks/cicd-stack.ts` y completa:

```ts
this.deployRole = new GithubOidcRole(this, 'GithubDeploy', {
  roleName: this.names.role('github-deploy'),
  githubRepo: this.cfg.githubRepo,
  existingProviderArn: props.existingProviderArn,
});
this.crossStackExport('DeployRoleArn', this.deployRole.role.roleArn);
```

> Solo puede existir **un** proveedor OIDC de GitHub por cuenta. El instructor ya lo creó; su ARN está en `CF_GITHUB_OIDC_PROVIDER_ARN` (pídelo y agrégalo al `.env`). Si tu cuenta fuera solo tuya, lo crearía el construct.

Descomenta el bloque de `CicdStack` en `infra/bin/crediflow.ts` (TODO parte F2).

```bash
cd infra && npx cdk deploy Cicd
ROLE_ARN=$(aws cloudformation describe-stacks --stack-name CrediFlow-$CF_STUDENT-dev-Cicd --query "Stacks[0].Outputs[?OutputKey=='OutDeployRoleArn'].OutputValue" --output text)
```
```powershell
cd infra; npx cdk deploy Cicd
$ROLE_ARN = aws cloudformation describe-stacks --stack-name "CrediFlow-$env:CF_STUDENT-dev-Cicd" --query "Stacks[0].Outputs[?OutputKey=='OutDeployRoleArn'].OutputValue" --output text
```

Lee la trust policy del rol en la consola (IAM → Roles): la condición `token.actions.githubusercontent.com:sub` = `repo:<tu-usuario>/crediflow:*`. **Nadie más** puede asumirlo.

### F3. Configurar GitHub (secretos, variables y entornos)

```bash
cd ..
gh secret set AWS_DEPLOY_ROLE_ARN --body "$ROLE_ARN"          # Windows: --body $ROLE_ARN
gh variable set CF_STUDENT --body "$CF_STUDENT"               # Windows: $env:CF_STUDENT
gh variable set AWS_ACCOUNT_ID --body "$CDK_DEFAULT_ACCOUNT"
gh variable set AWS_REGION --body "$CDK_DEFAULT_REGION"
gh variable set CF_ALERT_EMAIL --body "$CF_ALERT_EMAIL"
```

En github.com → tu repo → **Settings → Environments**: crea `dev` (sin reglas) y `prod` con **Required reviewers** = un compañero de equipo.

### F4. El flujo completo: rama → PR → CI → merge → deploy

```bash
git checkout -b feat/sesion-3-cdk
git add -A && git commit -m "feat: NetworkStack, DataStack y CicdStack con CDK"
git push -u origin feat/sesion-3-cdk
gh pr create --fill
```

Observa en GitHub → **Actions**: el workflow *CI (pull request)* compila, prueba y sintetiza con cdk-nag. Pide a un compañero que revise con la plantilla de PR (checklist del revisor) y aprueba.

```bash
gh pr merge --squash --delete-branch
```

Ahora corre *Deploy (dev → prod)*: el job `dev` despliega con el rol OIDC; el job `prod` queda **esperando aprobación**. Apruébalo (o rechaza, hoy no necesitamos prod).

Verifica que fue el pipeline y no tú: CloudTrail → Event history → `AssumeRoleWithWebIdentity` (en la sesión 6 lo veremos con detalle), o:

```bash
aws cloudformation describe-stack-events --stack-name CrediFlow-$CF_STUDENT-dev-Data --max-items 3 --query 'StackEvents[].[Timestamp,ResourceStatus]'
```

✅ **Checkpoint F:** PR con CI verde, merge, despliegue a dev por OIDC, prod en espera de aprobación.

### F5. Apagar

Lo de hoy no cobra por hora, pero el hábito empieza hoy: `npm run apagar` destruye tus stacks (vuelven en 3 minutos con `npm run encender` la próxima sesión; el rol de GitHub se recrea con el mismo nombre y el secreto en GitHub sigue válido). Si prefieres dejar `Network`, `Data` y `Cicd` encendidos hasta la sesión 4, su costo es ~0.01 USD/mes: decide con tu equipo y anótalo. Si en la sesión 2 no destruiste el despliegue manual, hazlo ahora: `despliegue-manual.sh limpiar` / `.ps1 limpiar`.

---

## Cierre (10 min)

1. [Checklist](checklist.md).
2. Reglas desde hoy: **ningún recurso se crea desde la consola** (si lo necesitas, es código + PR) y **`npm run encender` al inicio, `npm run apagar` al final** de cada sesión.
3. Trabajo asíncrono: [reto](reto.md); instalar Docker Desktop y verificar `docker run hello-world` (sesión 4).
