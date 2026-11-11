# Acceso a AWS: usuario del curso, `aws login` y `.env`

El curso usa **una cuenta AWS del curso** (no la de producción de Fedecrédito). Cada participante recibe un **usuario IAM** con el mismo nombre que su `CF_STUDENT`, en el grupo `crediflow-alumnos`, que permite crear recursos del proyecto y nada más. El acceso a la CLI y al SDK se hace con **`aws login`**: la CLI reutiliza la sesión del navegador y recibe credenciales **temporales** (se renuevan solas hasta 12 h y luego expiran).

> Nunca se usan llaves de acceso de larga duración (access keys): el grupo tiene un `Deny` explícito sobre `iam:CreateAccessKey`. Nunca se comparte la contraseña. Activa MFA en tu usuario el primer día.

## 1. Datos que te entrega el instructor

- URL de la consola: `https://crediflow-curso.signin.aws.amazon.com/console` (alias de la cuenta)
- ID de la cuenta del curso: `123456789012` (ejemplo)
- Tu usuario (= `CF_STUDENT`, ej. `ana-p`) y contraseña temporal
- Región: `us-east-1`

## 2. Primer inicio de sesión en la consola

Abre la URL, elige **IAM user**, escribe el alias o el ID de la cuenta, tu usuario y la contraseña temporal; te pedirá una contraseña nueva. Arriba a la derecha verás `ana-p @ crediflow-curso`. Activa MFA: tu nombre → **Security credentials** → **Assign MFA device** → *Authenticator app*.

## 3. Conectar la CLI (requiere AWS CLI 2.32 o superior)

Mac y Windows, mismo comando:

```bash
aws login --profile crediflow
```

Pregunta la región (`us-east-1`), abre el navegador, muestra tu identidad y pides **Allow**. Si el navegador no se abre, copia la URL que imprime la terminal (o usa `aws login --remote`). Comprueba:

```bash
aws sts get-caller-identity --profile crediflow
# "Arn": "arn:aws:iam::123456789012:user/ana-p"
```

Para no escribir `--profile` en cada comando:

```bash
# Mac (zsh)
echo 'export AWS_PROFILE=crediflow' >> ~/.zshrc && source ~/.zshrc
```
```powershell
# Windows (persistente para el usuario)
[Environment]::SetEnvironmentVariable('AWS_PROFILE', 'crediflow', 'User'); $env:AWS_PROFILE = 'crediflow'
```

Al empezar cada sesión del curso: `aws login --profile crediflow` otra vez (la anterior ya expiró). Para cerrar sesión: `aws logout --profile crediflow`.

## 4. Completar el `.env`

```ini
CF_STUDENT=ana-p
CF_ENV=dev
CDK_DEFAULT_ACCOUNT=123456789012
CDK_DEFAULT_REGION=us-east-1
AWS_PROFILE=crediflow
CF_ALERT_EMAIL=ana@ejemplo.com
CF_GITHUB_REPO=ana-p/crediflow
```

Cargar las variables en la terminal actual:

```bash
# Mac
source ./scripts/mac/load-env.sh
```
```powershell
# Windows
. .\scripts\windows\load-env.ps1
```

## 5. Verificar

```bash
npm run verify
```

Debes ver `✅ Identidad AWS  arn:aws:iam::123456789012:user/ana-p`.

## Si el SDK o CDK no reconocen el perfil

Las versiones recientes del SDK de JavaScript v3 (y por tanto CDK) leen el `login_session` del perfil. Si `node scripts/sdk/quien-soy.js` falla con un error de credenciales aunque la CLI funcione, primero `npm install` (actualiza el SDK). Si persiste, crea un perfil puente en `~/.aws/config` y úsalo en `AWS_PROFILE`:

```ini
[profile crediflow-sdk]
credential_process = aws configure export-credentials --profile crediflow --format process
region = us-east-1
```

## Para el instructor: preparar la cuenta

Ver el anexo de la guía del docente de la sesión 1. Resumen: alias de cuenta, grupo `crediflow-alumnos` con `SignInLocalDevelopmentAccess` + `PowerUserAccess` + `scripts/iam/politica-grupo-alumnos.json`, un usuario por alumno con `--password-reset-required` y etiqueta `Student`, activar `Student` como cost allocation tag, un presupuesto de la cuenta con alerta al instructor y, con root, el acceso a facturación para usuarios IAM.

Ajustes de la cuenta que se hacen **una sola vez** y que los stacks de los alumnos dan por hechos:

```bash
# Antes de la sesión 3: proveedor OIDC de GitHub (lo usa el rol de despliegue de cada alumno)
aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com --client-id-list sts.amazonaws.com

# Antes de la sesión 3: bootstrap de CDK en la cuenta y región del curso
npx cdk bootstrap aws://<ID de cuenta>/us-east-1

# Antes de la sesión 5: rol de registros de API Gateway (ajuste de cuenta, no de stack)
aws iam create-role --role-name crediflow-apigateway-logs \
  --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"apigateway.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
aws iam attach-role-policy --role-name crediflow-apigateway-logs --policy-arn arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs
aws apigateway update-account --patch-operations op=replace,path=/cloudwatchRoleArn,value=arn:aws:iam::<ID de cuenta>:role/crediflow-apigateway-logs
```

Cuotas que conviene pedir con una semana de margen (Service Quotas): VPC por región (alumnos × 2 + 5), concurrencia de Lambda (1,000; las cuentas nuevas pueden empezar con 10) y vCPU de Fargate bajo demanda.

En la sesión 6: GuardDuty se activa por CLI para la demostración (`aws guardduty create-detector --enable`, 30 días de prueba) y se desactiva al terminar el curso; el simulacro de incidente se inyecta con `node scripts/simulacro/falla.js <alumno> <1|2|3>` (ver la guía del docente de la sesión 6). El trabajo `Desplegar a prod` del pipeline es manual a propósito y no se lanza en el curso.

