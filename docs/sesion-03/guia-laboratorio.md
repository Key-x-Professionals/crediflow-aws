# Sesión 3 · Laboratorio: la infraestructura como código y tu pipeline

## Cómo usar esta guía

**Duración:** 100 minutos efectivos más un receso de 10 minutos después del bloque C. **Equipos de 3-4 personas:** cada uno escribe y despliega en su propia máquina; el equipo se revisa los pull requests y valida el checklist. **Entregable:** tu repositorio en GitHub con `NetworkStack`, `DataStack` y `CicdStack`, las pruebas pasando y un despliegue a dev hecho por el pipeline, sin llaves.

Convención: los bloques `bash` son para **Mac**; los bloques `powershell` para **Windows (PowerShell 7)**. Si solo hay un bloque, el comando es igual en ambos. Los bloques `ts` son código TypeScript que escribes en VS Code.

Lo que la semana pasada hiciste con unos 45 comandos, hoy lo escribes en dos archivos. Desde hoy rigen dos reglas hasta el final del curso: **ningún recurso se crea desde la consola** (la consola es para mirar) y **`npm run encender` al llegar, `npm run apagar` al salir**.

Los cinco bloques y su "listo cuando":

| Bloque | Qué haces | Listo cuando |
|---|---|---|
| A · Recorrido | Conoces el proyecto CDK y compruebas el bootstrap | `cdk ls` muestra tus stacks con tu nombre |
| B · Red | Escribes y despliegas `NetworkStack`, y lees un diff destructivo | El stack está en `CREATE_COMPLETE` y explicaste un reemplazo |
| C · Datos y pruebas | Escribes `DataStack` (tabla DynamoDB y buckets) y lo pruebas | Las pruebas pasan y leíste un ítem de tu tabla |
| D · Tu repositorio | Creas tu repositorio en GitHub y el rol que GitHub asumirá | El rol solo confía en tu repositorio |
| E · Pipeline | Rama, pull request, revisión, despliegue por pipeline y apagar | El pipeline desplegó a dev sin llaves |

> **Costo de hoy.** Una VPC sin NAT Gateway, una tabla DynamoDB bajo demanda, dos buckets vacíos y un rol: nada cobra por hora; si se quedara un mes serían centavos. Aun así, hoy empieza el hábito de apagar, porque la próxima semana aparecen el balanceador y los contenedores, que sí cobran.

## Antes de empezar

```bash
# Mac
aws login --profile crediflow
git checkout a03-inicio            # punto de partida de la sesión 3
npm install
source ./scripts/mac/load-env.sh
```
```powershell
# Windows
aws login --profile crediflow
git checkout a03-inicio
npm install
. .\scripts\windows\load-env.ps1
```

Comprueba que tienes la CLI de GitHub y una cuenta: `gh --version`. Si en la sesión 2 no llegaste a destruir el despliegue manual, hazlo ahora (`./scripts/manual/despliegue-manual.sh limpiar` o `.\scripts\manual\despliegue-manual.ps1 limpiar`).

## Bloque A · Recorrido por el proyecto CDK (10 min)

### A1. ¿La cuenta ya tiene bootstrap?

CDK necesita, una sola vez por cuenta y región, un bucket para subir archivos y unos roles para desplegar. Lo crea `cdk bootstrap` y ya lo hizo el instructor. Compruébalo:

```bash
aws cloudformation describe-stacks --stack-name CDKToolkit --query 'Stacks[0].StackStatus' --output text
```

Debe responder `CREATE_COMPLETE` (o `UPDATE_COMPLETE`).

### A2. Lee antes de escribir

Abre la carpeta `infra` en VS Code y recorre estos archivos. No escribas nada todavía.

| Archivo | Qué resuelve |
|---|---|
| `infra/lib/config.ts` | Lee tu `.env` y valida `CF_STUDENT` |
| `infra/lib/naming.ts` | Construye los nombres: `names.resource('vpc')` → `crediflow-<alumno>-dev-vpc` |
| `infra/lib/crediflow-stack.ts` | La clase base de todos los stacks: nombre, etiquetas, salidas |
| `infra/lib/constructs/` | Los bloques listos para usar: `CrediFlowVpc`, `SecureBucket`, `CrediFlowTable`… |
| `infra/lib/stacks/` | Un stack por sesión. **Aquí trabajas tú** |
| `infra/bin/crediflow.ts` | El punto de entrada: crea los stacks y los conecta |

Abre `constructs/crediflow-vpc.ts` y compáralo mentalmente con el paso `red` del script de la semana pasada: dos zonas, subredes públicas, tabla de rutas, gateway. Las mismas decisiones, escritas una vez. Fíjate además en lo que el comentario inicial dice que **no** hay: NAT Gateway.

### A3. Tus stacks

```bash
cd infra
npx cdk ls
```

Verás `Network (CrediFlow-<tu usuario>-dev-Network)`. El stack todavía no existe en AWS: `cdk ls` solo ejecuta tu programa y dice qué stacks describe. Tu nombre aparece porque `config.ts` leyó tu `.env`.

✅ **Listo cuando:** `cdk ls` muestra el stack de red con tu nombre de alumno.

## Bloque B · La red como código (25 min)

### B1. Completa `NetworkStack`

Abre `infra/lib/stacks/network-stack.ts`. Es un esqueleto con comentarios `TODO`. Complétalo así:

```ts
this.network = new CrediFlowVpc(this, 'Network', {
  vpcName: this.names.resource('vpc'),
  natGateways: this.cfg.natGateways,   // 0 por defecto: sin costo fijo
  removalPolicy: this.removalPolicy,
});

this.crossStackExport('VpcId', this.network.vpc.vpcId, 'ID del VPC de CrediFlow');
this.publishParameter('VpcIdParam', 'vpc-id', this.network.vpc.vpcId);
```

Qué escribiste: un construct (`CrediFlowVpc`) con tres propiedades; el nombre sale del constructor de nombres, no de tu teclado; y dos salidas, para que otros stacks y otras personas encuentren el identificador de la VPC sin copiarlo.

### B2. Sintetiza y cuenta

```bash
npx cdk synth Network --quiet
# Mac
grep -c '"Type": "AWS::' cdk.out/Network.template.json
# Windows
(Select-String -Path cdk.out\Network.template.json -Pattern '"Type": "AWS::').Count
```

Unos **28 recursos** de CloudFormation a partir de diez líneas. Abre `cdk.out/Network.template.json` y recórrelo: subredes, tablas de rutas, asociaciones, el gateway, dos *endpoints* (S3 y DynamoDB, gratuitos) y los *flow logs*. Si quieres, usa el prompt 3.1 para que la IA te explique cinco recursos que no esperabas. Y comprueba lo que no está: busca `NatGateway` en el archivo. No aparece: es una decisión de costo (unos 32 USD al mes) escrita en el construct; con `CF_NAT=true` en el `.env` aparecería.

### B3. Despliega y verifica

```bash
npx cdk deploy Network
```

Tarda unos dos minutos. Mientras corre, abre en la consola **CloudFormation → Stacks → `CrediFlow-<tu usuario>-dev-Network` → Events**: los recursos se crean en el orden que CloudFormation calculó. Al terminar:

```bash
# Mac
aws cloudformation describe-stacks --stack-name CrediFlow-$CF_STUDENT-dev-Network --query 'Stacks[0].StackStatus' --output text
aws ssm get-parameter --name /crediflow/$CF_STUDENT/dev/vpc-id --query Parameter.Value --output text
```
```powershell
# Windows
aws cloudformation describe-stacks --stack-name "CrediFlow-$env:CF_STUDENT-dev-Network" --query 'Stacks[0].StackStatus' --output text
aws ssm get-parameter --name "/crediflow/$env:CF_STUDENT/dev/vpc-id" --query Parameter.Value --output text
```

En la consola, **VPC → Your VPCs → `crediflow-<tu usuario>-dev-vpc` → Resource map**. Compárala con la de la sesión 2: dos zonas, subredes públicas y, en lugar de "privadas", subredes **aisladas** (sin ninguna salida a internet), más los dos endpoints. En cualquier recurso, pestaña **Tags**: `Project`, `Student`, `Environment`, `Session` y `ManagedBy = cdk`, puestas por la clase base sin que escribieras nada.

Observa también que apareció un archivo `infra/cdk.context.json` con las zonas de disponibilidad de la cuenta. **Ese archivo se versiona**: el pipeline lo necesita para sintetizar sin credenciales.

### B4. Un cambio destructivo, y un diff

En `network-stack.ts`, agrega dentro del `CrediFlowVpc` la propiedad `cidr: '10.2.0.0/16'` y **no despliegues**. Ejecuta:

```bash
npx cdk diff Network
```

Lee la salida con tu equipo. Busca `[~]`, `requires replacement` y `may be replaced`. ¿Qué se reemplaza? ¿Qué pasaría con lo que viviera dentro de esa VPC? Si quieres contrastar tu lectura, pega el diff en el prompt 3.3. Después **revierte el cambio** (borra la línea) y comprueba que `npx cdk diff Network` dice *There were no differences*.

✅ **Listo cuando:** el stack `Network` está en `CREATE_COMPLETE`, el diff vuelve a estar limpio y puedes explicar por qué cambiar el CIDR reemplaza la red entera.

## Bloque C · Datos y pruebas (25 min)

En la sesión 2 la base de datos fue PostgreSQL en RDS. Desde hoy CrediFlow guarda las solicitudes en **DynamoDB**: no cobra por hora, no vive en la VPC, no necesita contraseña y los primeros 25 GB son gratis siempre. La API no cambia: ya trae una capa de almacenamiento intercambiable.

### C1. Completa `DataStack`

Abre `infra/lib/stacks/data-stack.ts` y completa los `TODO`:

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

Qué escribiste: dos buckets con `SecureBucket` (abre el construct: cifrado, acceso público bloqueado, solo HTTPS y versionado, lo del reto de la semana pasada, ya incluido) y una tabla con clave `id` y dos índices. ¿Por qué dos índices? En DynamoDB no se consulta "lo que sea": se diseña desde las preguntas que hará la aplicación. La API pregunta "las últimas solicitudes" (índice `porFecha`) y el tablero de la sesión 6 preguntará "cuántas rechazadas hoy" (índice `porEstado`).

Ahora abre `infra/bin/crediflow.ts` y **descomenta la línea de `DataStack`** (está marcada con `TODO (bloque C)`).

### C2. Prueba antes de desplegar

```bash
npm test                      # desde infra/
```

Abre `infra/test/data-stack.test.ts`: sintetiza el stack en memoria y hace afirmaciones sobre la plantilla, sin crear nada en AWS. Agrega una prueba propia. La recuperación a un punto en el tiempo cuesta por GB, así que en dev debe estar apagada:

```ts
it('no activa point-in-time recovery en dev', () => {
  template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
    Replicas: [{ PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: false } }],
  });
});
```

Ejecuta `npm test` otra vez: deben pasar todas. Si te sobra tiempo, pide dos pruebas más con el prompt 3.2 y elige una.

### C3. Despliega y usa la tabla

```bash
npx cdk diff Data
npx cdk deploy Data           # menos de un minuto
```

Compara con la sesión 2: la base de datos aparece en segundos y no hay contraseña que guardar. Escribe un ítem, léelo por el índice y bórralo:

```bash
# Mac
export TABLA=crediflow-$CF_STUDENT-dev-tbl-solicitudes
aws dynamodb describe-table --table-name $TABLA --query 'Table.[TableStatus,BillingModeSummary.BillingMode,GlobalSecondaryIndexes[].IndexName]'
aws dynamodb put-item --table-name $TABLA --item '{"id":{"S":"prueba-1"},"gsi1pk":{"S":"SOLICITUD"},"creadaEn":{"S":"2026-01-01T00:00:00Z"},"estado":{"S":"RECIBIDA"},"nombre":{"S":"Prueba"}}'
aws dynamodb query --table-name $TABLA --index-name porFecha --key-condition-expression 'gsi1pk = :p' --expression-attribute-values '{":p":{"S":"SOLICITUD"}}' --query 'Items[].id.S'
aws dynamodb delete-item --table-name $TABLA --key '{"id":{"S":"prueba-1"}}'
```

En Windows, las comillas dentro del JSON dan problemas en la línea de comandos. Lo más simple es hacerlo desde la consola: **DynamoDB → Tables → `crediflow-<tu usuario>-dev-tbl-solicitudes` → Explore table items → Create item** (agrega `id`, `gsi1pk` = `SOLICITUD`, `creadaEn` y `estado`), consulta el índice `porFecha` con `gsi1pk = SOLICITUD` y borra el ítem. Es mirar y probar, no crear infraestructura: la regla de "nada desde la consola" se refiere a recursos.

En la consola, **CloudFormation → Exports**: los valores `crediflow-<tu usuario>-dev:…` que tus próximos stacks van a importar.

✅ **Listo cuando:** `npm test` pasa con tu prueba incluida, `Data` está desplegado y leíste un ítem por el índice `porFecha`. Ahora, **receso de 10 minutos**.

## Bloque D · Tu repositorio y el rol de GitHub (20 min)

Hasta hoy trabajaste sobre una copia del repositorio base. Desde ahora trabajas en **tu** repositorio.

### D1. Crea tu repositorio

```bash
cd ..                                  # raíz del proyecto
git checkout -B main                   # tu rama principal parte de donde estás
git remote rename origin base          # el repositorio del curso pasa a llamarse "base"
gh auth login                          # una vez: GitHub.com → HTTPS → navegador
gh repo create crediflow --private --source=. --remote=origin --push
gh repo set-default <tu usuario de GitHub>/crediflow     # para que gh no confunda tu repositorio con el del curso
```

Si no usas `gh`: crea un repositorio vacío llamado `crediflow` en github.com y ejecuta `git remote add origin https://github.com/<tu usuario>/crediflow.git && git push -u origin main`.

Eso subió el punto de partida de hoy (los esqueletos), **sin** tus cambios, que siguen sin confirmar en tu carpeta: van a viajar por un pull request en el bloque E. En la pestaña **Actions** de tu repositorio verás un despliegue omitido: el pipeline no hace nada hasta que le digas quién eres (D3). Abre tu `.env` y pon tu repositorio:

```ini
CF_GITHUB_REPO=<tu usuario de GitHub>/crediflow
```

Recarga el entorno (`source ./scripts/mac/load-env.sh` o `. .\scripts\windows\load-env.ps1`).

### D2. `CicdStack`: el rol que GitHub va a asumir

Abre `infra/lib/stacks/cicd-stack.ts` y completa el `TODO`:

```ts
this.deployRole = new GithubOidcRole(this, 'GithubDeploy', {
  roleName: this.names.role('github-deploy'),
  githubRepo: this.cfg.githubRepo,
  existingProviderArn: props.existingProviderArn,
});
this.crossStackExport('DeployRoleArn', this.deployRole.role.roleArn);
```

En `infra/bin/crediflow.ts` **descomenta el bloque de `CicdStack`** (`TODO (bloque D)`).

> En una cuenta solo puede existir **un** proveedor OIDC de GitHub, y en la del curso ya lo creó el instructor: todos lo comparten. Lo que es tuyo es el rol.

```bash
cd infra
npx cdk deploy Cicd                    # te pedirá confirmar porque crea permisos de IAM: responde "y"
```

Guarda el ARN del rol en una variable:

```bash
# Mac
ROLE_ARN=$(aws cloudformation describe-stacks --stack-name CrediFlow-$CF_STUDENT-dev-Cicd --query "Stacks[0].Outputs[?OutputKey=='OutDeployRoleArn'].OutputValue" --output text); echo $ROLE_ARN
```
```powershell
# Windows
$ROLE_ARN = aws cloudformation describe-stacks --stack-name "CrediFlow-$env:CF_STUDENT-dev-Cicd" --query "Stacks[0].Outputs[?OutputKey=='OutDeployRoleArn'].OutputValue" --output text; $ROLE_ARN
```

Ahora lee, en la consola, quién puede asumir ese rol: **IAM → Roles → `crediflow-<tu usuario>-dev-role-github-deploy` → Trust relationships**. Verás la condición `token.actions.githubusercontent.com:sub` igual a `repo:<tu usuario>/crediflow:*`. Solo un job de GitHub Actions de **tu** repositorio puede obtener credenciales con este rol. En la pestaña **Permissions**: lo único que puede hacer es asumir los roles `cdk-*` del bootstrap.

### D3. Dile a GitHub cuál es el rol

```bash
# Mac
cd ..
gh secret set AWS_DEPLOY_ROLE_ARN --body "$ROLE_ARN"
gh variable set CF_STUDENT --body "$CF_STUDENT"
gh variable set AWS_ACCOUNT_ID --body "$CDK_DEFAULT_ACCOUNT"
gh variable set AWS_REGION --body "$CDK_DEFAULT_REGION"
gh variable set CF_ALERT_EMAIL --body "$CF_ALERT_EMAIL"
```
```powershell
# Windows
cd ..
gh secret set AWS_DEPLOY_ROLE_ARN --body $ROLE_ARN
gh variable set CF_STUDENT --body $env:CF_STUDENT
gh variable set AWS_ACCOUNT_ID --body $env:CDK_DEFAULT_ACCOUNT
gh variable set AWS_REGION --body $env:CDK_DEFAULT_REGION
gh variable set CF_ALERT_EMAIL --body $env:CF_ALERT_EMAIL
```

Fíjate en lo que acabas de guardar en GitHub: un ARN y cuatro valores de configuración. **Ninguna llave de acceso.**

✅ **Listo cuando:** `Cicd` está desplegado, la política de confianza del rol nombra tu repositorio y `gh secret list` muestra `AWS_DEPLOY_ROLE_ARN`.

## Bloque E · El pipeline (20 min)

### E1. Abre una rama y un pull request

```bash
git checkout -b feat/sesion-3-cdk
git add -A
git commit -m "feat: NetworkStack, DataStack y CicdStack con CDK"
git push -u origin feat/sesion-3-cdk
gh pr create --fill
```

`git add -A` incluye `infra/cdk.context.json`: tiene que ir en el commit.

### E2. Integración continua y revisión

En github.com, tu repositorio → **Actions**: el workflow **CI (pull request)** instala, compila, ejecuta las pruebas (incluida la tuya) y sintetiza. Mientras corre, abre `.github/workflows/ci.yml` y `deploy.yml` y léelos: son los dos archivos que definen todo el pipeline.

Pide a un compañero de equipo que revise tu pull request con la lista de la plantilla (pestaña **Files changed**). Si el CI falla, abre el paso en rojo y, si no entiendes el error, pega el registro en el prompt 3.4.

### E3. Fusiona y mira el despliegue

```bash
gh pr merge --squash --delete-branch
```

En **Actions** arranca **Deploy (dev -> prod)**. El job *Desplegar a dev* pide un token a GitHub, lo cambia por credenciales temporales de tu rol y ejecuta `cdk deploy --all`. Como ya habías desplegado lo mismo desde tu máquina, verás *no changes*: es la prueba de que tu código y lo desplegado coinciden. El job de **prod** aparece como omitido: solo se lanza a mano y con aprobación. **En este curso no se despliega prod**: crearía un segundo juego de recursos, con costo.

Comprueba que fue el pipeline, y no tú, quien se identificó en AWS:

```bash
aws cloudtrail lookup-events --lookup-attributes AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity --max-results 3 --query 'Events[].[EventTime,Username]' --output table
```

(Puede tardar unos minutos en aparecer.)

### E4. Apagar

Lo de hoy no cobra por hora, pero el hábito empieza hoy:

```bash
git checkout main && git pull
npm run apagar          # cdk destroy --all: unos 3 minutos
npm run costos          # no debe marcar nada "por hora"
```

`apagar` destruye tus tres stacks, incluidos la tabla, los buckets y el rol de GitHub. La próxima sesión, `npm run encender` los recrea con los mismos nombres en unos minutos, y el secreto que guardaste en GitHub sigue sirviendo porque el ARN del rol no cambia. Mientras estén apagados, el pipeline no puede desplegar: es lo esperado.

✅ **Listo cuando:** tu pull request se fusionó con el CI en verde, el job de dev terminó bien y `npm run costos` no marca nada por hora.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `Falta la variable de entorno CF_STUDENT` | No cargaste el entorno en esta terminal: `load-env` |
| `Need to perform AWS calls for account …, but no credentials` | `aws login --profile crediflow` y vuelve a cargar el entorno |
| `This stack uses assets, so the toolkit stack must be deployed` | Falta el bootstrap de la cuenta: avisa al instructor |
| `VpcLimitExceeded` | Quedó una VPC manual de la sesión 2 o la cuota es baja: ejecuta `limpiar` del script manual o avisa al instructor |
| `npm test` falla con "Cannot find module" | Ejecutaste desde la raíz sin instalar: `npm install` en la raíz y `npm test` dentro de `infra` |
| `Export … cannot be deleted as it is in use` | Otro stack usa esa salida: destruye o despliega en orden (`Cicd`, `Data`, `Network`) |
| `gh: command not found` | Instala la CLI de GitHub o crea el repositorio desde github.com |
| El CI falla en "Sintetizar" pidiendo credenciales | No subiste `infra/cdk.context.json`: `git add infra/cdk.context.json`, commit y push |
| El job de dev falla con `Not authorized to perform sts:AssumeRoleWithWebIdentity` | `CF_GITHUB_REPO` no coincide con tu repositorio (mayúsculas incluidas): corrige el `.env`, `cdk deploy Cicd` y repite |
| El job de dev falla con `Could not load credentials` | Falta el secreto `AWS_DEPLOY_ROLE_ARN`: repite D3 |

## Cierre

### Checklist de verificación (por equipo)

Marca cada punto solo cuando **todos** los integrantes lo hayan completado.

- [ ] `cdk ls` muestra mis stacks con mi nombre de alumno
- [ ] `Network` desplegado: VPC en dos zonas, sin NAT Gateway, con las cinco etiquetas
- [ ] Leímos el diff de cambiar el CIDR y podemos explicar qué significa `requires replacement`
- [ ] `Data` desplegado: tabla `tbl-solicitudes` bajo demanda con dos índices y dos buckets cifrados y sin acceso público
- [ ] `npm test` pasa, con al menos una prueba escrita por mí
- [ ] Tengo mi repositorio en GitHub y `CF_GITHUB_REPO` apunta a él
- [ ] El rol `role-github-deploy` solo confía en mi repositorio (lo leí en *Trust relationships*)
- [ ] En GitHub hay un ARN y variables de configuración, y **ninguna** llave de acceso
- [ ] Pull request revisado por un compañero, CI en verde, fusionado
- [ ] El job de dev desplegó con OIDC; no lanzamos prod
- [ ] `npm run apagar` ejecutado y `npm run costos` sin recursos por hora
- [ ] Podemos explicar por qué CrediFlow pasó de RDS a DynamoDB y qué se cede con el cambio

### Dos reglas desde hoy

1. **Ningún recurso se crea desde la consola.** Si lo necesitas, es código y pull request. La consola es para mirar, verificar y aprender.
2. **`npm run encender` al llegar y `npm run apagar` al salir** de cada sesión.

### Para la sesión 4

- Instala **Docker Desktop** y comprueba que funciona: `docker run hello-world`. En Windows requiere WSL 2 (`wsl --install` y reiniciar). Es lo que más tiempo quita si se deja para la clase.
- Lee `apps/api/Dockerfile` y `infra/lib/constructs/crediflow-fargate-service.ts`.
- Dudas al canal del curso.

### Reto para casa (opcional, 30-40 min, sin costo y sin desplegar)

**Objetivo.** Agregar dos pruebas de infraestructura y demostrar que tu pipeline bloquea un cambio que las rompe.

**Cómo.** En `infra/test/data-stack.test.ts` escribe dos pruebas: (1) todos los buckets tienen cifrado por defecto; (2) la tabla tiene exactamente dos índices. Una pista para cada una:

```ts
it('todos los buckets están cifrados', () => {
  template.allResourcesProperties('AWS::S3::Bucket', {
    BucketEncryption: Match.objectLike({ ServerSideEncryptionConfiguration: Match.anyValue() }),
  });
});

it('la tabla tiene exactamente dos índices', () => {
  const tablas = template.findResources('AWS::DynamoDB::GlobalTable');
  const indices = Object.values(tablas)[0].Properties.GlobalSecondaryIndexes;
  expect(indices).toHaveLength(2);
});
```

(`Match` se importa de `aws-cdk-lib/assertions`.) Comprueba con `npm test` que pasan. Después, en una rama nueva, **rompe una a propósito**: comenta el índice `porEstado` en `data-stack.ts`, haz commit, push y abre un pull request.

**Cómo comprobar.** El workflow CI del pull request debe quedar en rojo, y en el registro del paso *Pruebas* debe aparecer el nombre de tu prueba. Restaura el índice, haz commit y push: el mismo pull request debe pasar a verde. Fusiona solo entonces. (Como apagaste, el job de despliegue fallará al no encontrar el rol: es lo esperado; la próxima sesión, tras `npm run encender`, puedes relanzarlo.)

**Qué entregas.** En el canal del curso: el enlace a tu pull request, donde se vean la ejecución en rojo y la ejecución en verde, y el código de tus dos pruebas. Si usaste IA, cuenta qué le pediste y qué tuviste que corregir.

**Bonus.** Agrega `expect(template.toJSON()).toMatchSnapshot()` y haz un cambio pequeño para ver cómo falla. ¿Cuándo ayuda una prueba así y cuándo estorba?
