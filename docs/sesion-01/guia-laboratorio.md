# Sesión 1 · Laboratorio: tu acceso, tus permisos, tus costos y CrediFlow en tu máquina

## Cómo usar esta guía

**Duración:** 100 minutos efectivos más un receso de 10 minutos después del bloque C. **Equipos de 3-4 personas:** cada uno ejecuta en su propia terminal; el equipo valida el checklist al final. **Entregable:** acceso a AWS funcionando por consola, CLI y SDK; un rol de mínimo privilegio probado (incluido un `AccessDenied` explicado); una estimación de costo; CrediFlow corriendo en tu máquina.

Convención: los bloques `bash` son para **Mac**; los bloques `powershell` para **Windows (PowerShell 7)**. Si solo hay un bloque, el comando es igual en ambos. Trabaja siempre dentro de la carpeta del repositorio (`cd crediflow`), con la [guía de instalación](../00-preparacion/instalacion.md) ya completada.

Los cinco bloques y su "listo cuando":

| Bloque | Qué haces | Listo cuando |
|---|---|---|
| A · Acceso | Entras a AWS con tu usuario del curso desde el navegador, la terminal y el repositorio | `npm run verify` muestra tu identidad en verde |
| B · Explorar | Ves dónde vive AWS: regiones y zonas, en CLI y consola | Ubicas us-east-1 y sus zonas en ambos lugares |
| C · Permisos | Creas un bucket y un rol que solo puede leerlo | Lees un objeto y al subir uno recibes `AccessDenied` |
| D · Costos | Entiendes qué cuesta y cuánto crédito queda | Ubicas el crédito restante y anotaste la estimación de la sesión 2 |
| E · SDK y local | Hablas con AWS desde código y corres la app | La app responde en el navegador y en la CLI |

## Antes de empezar: lo que te entrega el instructor

| Dato | Ejemplo | Dónde lo usas |
|---|---|---|
| URL de inicio de sesión de la consola | `https://crediflow-curso.signin.aws.amazon.com/console` | Navegador |
| ID de la cuenta del curso (12 dígitos) | `123456789012` | `.env` y comandos |
| Tu usuario (es tu `CF_STUDENT`) | `ana-p` | Inicio de sesión y `.env` |
| Contraseña temporal | (la cambias al entrar) | Primer inicio de sesión |
| Región | `us-east-1` | Todo el curso |

La cuenta es **una sola para todo el grupo**: cada persona tiene su propio usuario y todo lo que crea lleva su nombre como prefijo (`crediflow-ana-p-…`). Así nadie pisa el trabajo de otro y el costo se puede separar por persona. Tres reglas desde hoy: **nunca** se crean llaves de acceso permanentes (access keys); **nunca** se comparte la contraseña; **nunca** se usan datos, sistemas ni credenciales reales de Fedecrédito: CrediFlow es ficticio.

## Bloque A · Acceso a AWS (20 min)

### A1. Entra a la consola y cambia tu contraseña

Abre la URL de la consola en el navegador. Elige **IAM user**, escribe el ID de la cuenta o su alias (`crediflow-curso`), tu usuario y la contraseña temporal. La primera vez te pedirá una contraseña nueva: usa una larga que no uses en otro lado y guárdala en tu gestor de contraseñas.

Ya dentro, mira **arriba a la derecha**: verás `ana-p @ crediflow-curso` (tu usuario y la cuenta). Confirma que la región (también arriba a la derecha) es **N. Virginia (us-east-1)**; si no, cámbiala.

> Recomendado (2 min): activa MFA en tu usuario. Clic en tu nombre → **Security credentials** → **Assign MFA device** → *Authenticator app* y escanea el código con Google Authenticator, Microsoft Authenticator o Authy. En el reto de hoy verás para qué sirve.

### A2. Conecta la terminal con `aws login`

Desde la sesión 2 todo se hace desde la terminal, así que la CLI necesita la misma identidad. En lugar de llaves permanentes usamos **`aws login`**: la CLI abre el navegador, tú apruebas con la sesión que ya tienes abierta, y la CLI recibe credenciales **temporales** que se renuevan solas durante la clase (hasta 12 horas) y luego expiran. Igual en Mac y Windows:

```bash
aws login --profile crediflow
```

Qué pasa: la terminal pregunta la región (escribe `us-east-1`), abre el navegador en la página de inicio de sesión de AWS, te muestra la identidad con la que entraste en A1 y un botón para permitir el acceso. Al aceptar, vuelve a la terminal y verás que el perfil `crediflow` quedó guardado. Si el navegador no se abre solo, copia la URL que imprime la terminal y pégala tú.

Ahora pregúntale a AWS quién eres:

```bash
aws sts get-caller-identity --profile crediflow
```

Debes ver algo así:

```json
{
  "UserId": "AIDAEXAMPLE…",
  "Account": "123456789012",
  "Arn": "arn:aws:iam::123456789012:user/ana-p"
}
```

El `Arn` es tu nombre completo dentro de AWS: cuenta y usuario. Compáralo con lo que ves arriba a la derecha en la consola: **es la misma identidad**, la CLI y el navegador comparten la sesión.

### A3. Haz que la CLI use el perfil siempre

Para no escribir `--profile crediflow` en cada comando:

```bash
# Mac
echo 'export AWS_PROFILE=crediflow' >> ~/.zshrc && source ~/.zshrc
```
```powershell
# Windows
[Environment]::SetEnvironmentVariable('AWS_PROFILE', 'crediflow', 'User'); $env:AWS_PROFILE = 'crediflow'
```

Prueba: `aws sts get-caller-identity` (ya sin `--profile`) debe responder lo mismo.

### A4. Completa tu `.env`

En VS Code (`code .env`) deja estas líneas con tus datos:

```ini
CF_STUDENT=ana-p                      # tu usuario del curso
CF_ENV=dev
CDK_DEFAULT_ACCOUNT=123456789012      # ID de la cuenta del curso
CDK_DEFAULT_REGION=us-east-1
AWS_PROFILE=crediflow
CF_ALERT_EMAIL=ana@fedecredito.com.sv # aquí llegarán las notificaciones de CrediFlow (sesión 5)
```

### A5. Carga las variables y verifica

```bash
# Mac
source ./scripts/mac/load-env.sh
npm run verify
```
```powershell
# Windows
. .\scripts\windows\load-env.ps1
npm run verify
```

✅ **Listo cuando:** `npm run verify` muestra ✅ en "Identidad AWS" con tu ARN (`…:user/ana-p`).

Si algo falla: la terminal no abre el navegador → copia la URL que imprime; `aws: error: argument command: Invalid choice: 'login'` → tu AWS CLI es anterior a 2.32, actualízala (guía de instalación); el navegador dice que no tienes permiso → avisa al instructor (tu usuario necesita el permiso `SignInLocalDevelopmentAccess`); `ExpiredToken` en otra sesión del curso → repite `aws login --profile crediflow`.

## Bloque B · Explorar la infraestructura global (15 min)

AWS vive en lugares físicos: regiones (áreas geográficas) con varias zonas de disponibilidad (grupos de centros de datos independientes). Míralo desde la CLI:

```bash
# Regiones habilitadas en la cuenta
aws ec2 describe-regions --query 'Regions[].RegionName' --output table

# Zonas de disponibilidad de tu región, con su identificador físico (ZoneId)
aws ec2 describe-availability-zones --query 'AvailabilityZones[].[ZoneName,ZoneId,State]' --output table

# Qué ya existe en la cuenta con la etiqueta del curso (lo que crearon tus compañeros)
aws resourcegroupstaggingapi get-resources --tag-filters Key=Project,Values=crediflow --query 'ResourceTagMappingList[].ResourceARN' --output table
```

Ahora en la consola: el **selector de región** (arriba a la derecha) muestra la misma lista que el primer comando. Entra al servicio **EC2 → EC2 Dashboard** y baja hasta **Zones**: ahí están los mismos `ZoneId` del segundo comando.

**Discute en equipo (3 min):** ¿por qué `us-east-1a` de esta cuenta puede no ser la misma zona física que `us-east-1a` de otra cuenta? Pista: el `ZoneId` (`use1-az1`) es el nombre físico; el `ZoneName` se asigna por cuenta para repartir la carga.

✅ **Listo cuando:** ubicas us-east-1 y sus zonas en la CLI y en la consola, y puedes explicar la diferencia entre `ZoneName` y `ZoneId`.

## Bloque C · Mínimo privilegio en la práctica (30 min)

Vas a crear un bucket (una carpeta de archivos en S3), un **rol** que solo puede leer ese bucket, y vas a comprobar que al "ponerte" ese rol puedes leer pero no escribir. Es el patrón con el que la API de CrediFlow accederá a sus recursos en las próximas sesiones: identidades con permisos exactos, sin contraseñas.

### C1. Bucket del laboratorio y un objeto

```bash
# Mac
export BUCKET=crediflow-$CF_STUDENT-lab1-$CDK_DEFAULT_ACCOUNT
aws s3 mb s3://$BUCKET
echo "hola desde $CF_STUDENT" > hola.txt
aws s3 cp hola.txt s3://$BUCKET/hola.txt
aws s3 ls s3://$BUCKET
```
```powershell
# Windows
$env:BUCKET = "crediflow-$env:CF_STUDENT-lab1-$env:CDK_DEFAULT_ACCOUNT"
aws s3 mb s3://$env:BUCKET
"hola desde $env:CF_STUDENT" | Set-Content hola.txt
aws s3 cp hola.txt s3://$env:BUCKET/hola.txt
aws s3 ls s3://$env:BUCKET
```

Verifica en la consola: **S3 → Buckets** → tu bucket → el objeto `hola.txt`. Fíjate en la pestaña **Permissions**: "Block all public access: On" viene activo por defecto.

### C2. La política de solo lectura y el rol

Las plantillas están en `scripts/iam/`. Reemplaza los marcadores `STUDENT` y `ACCOUNT_ID` con tus datos y crea el rol:

```bash
# Mac
sed "s/STUDENT/$CF_STUDENT/g; s/ACCOUNT_ID/$CDK_DEFAULT_ACCOUNT/g" scripts/iam/politica-lectura-s3.json > politica.json
sed "s/STUDENT/$CF_STUDENT/g; s/ACCOUNT_ID/$CDK_DEFAULT_ACCOUNT/g" scripts/iam/trust-policy-lab.json > trust.json
export ROL=crediflow-$CF_STUDENT-lab1-lector
aws iam create-role --role-name $ROL --assume-role-policy-document file://trust.json --tags Key=Student,Value=$CF_STUDENT Key=Project,Value=crediflow
aws iam put-role-policy --role-name $ROL --policy-name lectura-s3 --policy-document file://politica.json
```
```powershell
# Windows
(Get-Content scripts\iam\politica-lectura-s3.json) -replace 'STUDENT', $env:CF_STUDENT -replace 'ACCOUNT_ID', $env:CDK_DEFAULT_ACCOUNT | Set-Content politica.json
(Get-Content scripts\iam\trust-policy-lab.json) -replace 'STUDENT', $env:CF_STUDENT -replace 'ACCOUNT_ID', $env:CDK_DEFAULT_ACCOUNT | Set-Content trust.json
$env:ROL = "crediflow-$env:CF_STUDENT-lab1-lector"
aws iam create-role --role-name $env:ROL --assume-role-policy-document file://trust.json --tags "Key=Student,Value=$env:CF_STUDENT" "Key=Project,Value=crediflow"
aws iam put-role-policy --role-name $env:ROL --policy-name lectura-s3 --policy-document file://politica.json
```

Abre `politica.json` en VS Code y léela con la lámina "Una política IAM, línea por línea" a la vista: `Effect` (Allow), `Action` (solo `s3:ListBucket` y `s3:GetObject`), `Resource` (el bucket y, en otra línea, sus objetos `/*`). Si quieres, usa el prompt 1.1 de `docs/sesion-01/prompts.md` para que la IA te la explique.

Abre también `trust.json`: es la **política de confianza** del rol y dice *quién puede ponérselo*. Su `Principal` es `arn:aws:iam::<cuenta>:user/<tu usuario>`: **solo tú** puedes asumir tu rol, aunque todos estén en la misma cuenta.

### C3. Asume el rol

Al asumir el rol, STS te entrega credenciales temporales **del rol**, no tuyas. Las pones en variables de entorno y la CLI empieza a usarlas en lugar de tu perfil:

```bash
# Mac
CREDS=$(aws sts assume-role --role-arn arn:aws:iam::$CDK_DEFAULT_ACCOUNT:role/$ROL --role-session-name lab1 --query 'Credentials' --output json)
export AWS_ACCESS_KEY_ID=$(echo $CREDS | node -pe 'JSON.parse(require("fs").readFileSync(0)).AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo $CREDS | node -pe 'JSON.parse(require("fs").readFileSync(0)).SecretAccessKey')
export AWS_SESSION_TOKEN=$(echo $CREDS | node -pe 'JSON.parse(require("fs").readFileSync(0)).SessionToken')
unset AWS_PROFILE
aws sts get-caller-identity        # ahora eres el rol lector
```
```powershell
# Windows
$creds = aws sts assume-role --role-arn "arn:aws:iam::$env:CDK_DEFAULT_ACCOUNT:role/$env:ROL" --role-session-name lab1 --query Credentials --output json | ConvertFrom-Json
$env:AWS_ACCESS_KEY_ID = $creds.AccessKeyId
$env:AWS_SECRET_ACCESS_KEY = $creds.SecretAccessKey
$env:AWS_SESSION_TOKEN = $creds.SessionToken
Remove-Item Env:AWS_PROFILE
aws sts get-caller-identity        # ahora eres el rol lector
```

El `Arn` ahora dice `assumed-role/crediflow-ana-p-lab1-lector/lab1`: cambiaste de identidad.

### C4. Prueba: leer sí, escribir no

```bash
aws s3 ls s3://$BUCKET                       # ✅ funciona          (Windows: $env:BUCKET)
aws s3 cp hola.txt s3://$BUCKET/otro.txt     # ❌ AccessDenied      (Windows: $env:BUCKET)
```

Lee el error completo con tu equipo e identifica los cuatro elementos: **quién** lo pidió (el ARN del rol asumido), **qué acción** (`s3:PutObject`), **sobre qué recurso** (el ARN del objeto) y **por qué** (la política solo permite `ListBucket` y `GetObject`; todo lo que no está permitido explícitamente queda denegado). Si quieres, prompt 1.3.

### C5. Vuelve a tu identidad (imprescindible antes del bloque D)

```bash
# Mac
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN; export AWS_PROFILE=crediflow
aws sts get-caller-identity        # de nuevo …:user/ana-p
```
```powershell
# Windows
Remove-Item Env:AWS_ACCESS_KEY_ID, Env:AWS_SECRET_ACCESS_KEY, Env:AWS_SESSION_TOKEN; $env:AWS_PROFILE = 'crediflow'
aws sts get-caller-identity        # de nuevo …:user/ana-p
```

Verifica en la consola: **IAM → Roles** → tu rol → pestaña **Permissions** (la política inline `lectura-s3`) y **Trust relationships** (tu usuario como principal). En **Access Advisor** verás que el rol usó S3 y nada más.

✅ **Listo cuando:** la lectura funcionó, la escritura dio `AccessDenied` y tu equipo puede explicar los cuatro elementos del error. Luego, receso de 10 minutos.

## Bloque D · Entender los costos (15 min)

La cuenta del curso funciona con el **crédito del plan gratuito de AWS**: si se agota, se suspende para todos. El presupuesto con alerta de la cuenta ya lo tiene configurado el instructor; lo que te toca a ti hoy es saber dónde mirar y cómo estimar antes de crear.

### D1. ¿Cuánto crédito queda?

En la consola: **Billing and Cost Management → Free Tier** (menú de la izquierda). Verás el crédito restante, los días que quedan del plan gratuito y el consumo del mes por servicio. Anota los dos primeros números en el canal del equipo: los volveremos a mirar en cada sesión.

### D2. ¿Quién gastó qué? Cost Explorer y etiquetas

**Billing and Cost Management → Cost Explorer**. Agrupa por **Service** y luego filtra por la etiqueta **Student** con tu usuario: hoy estará vacío (los datos tardan hasta 24 h y todavía no has creado nada que cueste); en la sesión 3 verás tus propios recursos. Esto funciona porque todo lo que creamos lleva las etiquetas `Project`, `Student`, `Environment` y `Session`: desde la sesión 3 CDK las pone solo; hoy, en el bloque C, tú mismo etiquetaste el rol con `--tags`. Compruébalo desde la CLI:

```bash
aws resourcegroupstaggingapi get-resources --tag-filters Key=Student,Values=$CF_STUDENT --query 'ResourceTagMappingList[].ResourceARN' --output table
```
```powershell
aws resourcegroupstaggingapi get-resources --tag-filters "Key=Student,Values=$env:CF_STUDENT" --query 'ResourceTagMappingList[].ResourceARN' --output table
```

### D3. Estima antes de crear (en equipo, 3 min)

En **calculator.aws** estima el costo mensual de lo que crearán en la sesión 2: 1 instancia EC2 `t3.micro`, 1 base de datos RDS `db.t4g.micro` con 20 GB y 1 bucket con 1 GB, en us-east-1. Anota el número y luego divídelo entre 730 (horas del mes) y multiplícalo por 3: eso es lo que costará la sesión 2 si la destruyen al terminar la clase. En la sesión 2 lo comparan con el costo real.

✅ **Listo cuando:** sabes dónde ver el crédito restante de la cuenta, tu rol aparece filtrando por la etiqueta `Student` y anotaste la estimación de la sesión 2.

## Bloque E · El SDK y CrediFlow en tu máquina (20 min)

### E1. La misma identidad desde código

Hasta ahora hablaste con AWS por el navegador y por la CLI. La tercera forma es desde un programa, con el SDK:

```bash
node scripts/sdk/quien-soy.js
```

Debe imprimir tu mismo `Arn`. Abre `scripts/sdk/quien-soy.js` en VS Code: `GetCallerIdentityCommand` es exactamente la llamada que hace `aws sts get-caller-identity`. Consola, CLI y SDK son tres clientes de la misma API, con las mismas credenciales: el SDK encontró solo la sesión que creaste con `aws login` (variable `AWS_PROFILE`). Así es como la API de CrediFlow hablará con S3, SQS y DynamoDB en las próximas sesiones, sin ninguna contraseña en el código.

### E2. CrediFlow corriendo localmente (todavía sin AWS)

Terminal 1, la API con almacenamiento en memoria:

```bash
npm run api:dev
```

Terminal 2, el frontend:

```bash
cd apps/web
cp .env.example .env.local        # Windows: Copy-Item .env.example .env.local
npm run dev
```

Abre `http://localhost:3001`: en **Estado**, la tarjeta de la API en verde (`storage: memory`); en **Nueva solicitud**, crea una con los datos de ejemplo y mírala en **Solicitudes** con estado `RECIBIDA` (sin evaluación todavía: eso llega en la sesión 5). Esta misma aplicación es la que irá moviéndose a AWS pieza por pieza durante el curso.

### E3. La misma API desde la CLI

La API también es una API para máquinas:

```bash
# Mac
curl -s http://localhost:3000/health
curl -s -X POST http://localhost:3000/solicitudes -H "Content-Type: application/json" \
  -d '{"nombre":"Ana Pérez","documento":"01234567-8","monto":5000,"plazoMeses":24,"ingresoMensual":1200,"proposito":"consumo"}'
```
```powershell
# Windows
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod -Method Post -Uri http://localhost:3000/solicitudes -ContentType "application/json" `
  -Body '{"nombre":"Ana Pérez","documento":"01234567-8","monto":5000,"plazoMeses":24,"ingresoMensual":1200,"proposito":"consumo"}'
```

Recarga la página de **Solicitudes**: la solicitud creada por CLI aparece también. Detén ambos servidores con `Ctrl+C` al terminar.

✅ **Listo cuando:** el SDK respondió con tu identidad y creaste una solicitud desde la web y desde la CLI.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `aws login` no abre el navegador | Copia la URL que imprime la CLI y pégala en el navegador. En una máquina sin navegador: `aws login --remote` |
| `Invalid choice: 'login'` | AWS CLI anterior a 2.32: actualiza (guía de instalación) |
| El navegador dice "no autorizado" al aprobar | Tu usuario no tiene el permiso `SignInLocalDevelopmentAccess`: avisa al instructor |
| `Unable to locate credentials` | Falta `aws login --profile crediflow`, o `AWS_PROFILE` no está definida en esta terminal |
| `quien-soy.js` falla con credenciales aunque la CLI funciona | Versiones viejas del SDK no entienden `login_session`. Ejecuta `npm install` en el repositorio; si persiste, el instructor te da el perfil alterno con `credential_process` |
| `npm run verify` marca ❌ en `CF_STUDENT` | Usa solo minúsculas, números y guiones, 2-12 caracteres, igual a tu usuario |
| `AccessDenied` al crear el rol (C2) | El nombre del rol debe empezar con `crediflow-`; revisa `$ROL` |
| `assume-role` da `AccessDenied` (C3) | El reemplazo de `STUDENT`/`ACCOUNT_ID` no se hizo, o tu usuario no se llama igual que `CF_STUDENT`: revisa `trust.json` |
| Después de C5 sigues siendo el rol lector | Abre una terminal nueva; las variables `AWS_ACCESS_KEY_ID`… siguen definidas |
| Puerto 3000 o 3001 ocupado | `PORT=3010 npm run api:dev` (Mac) / `$env:PORT=3010; npm run api:dev` (Windows), y ajusta `NEXT_PUBLIC_API_URL` en `apps/web/.env.local` |
| `Invoke-RestMethod` falla con el JSON | Usa comillas simples por fuera y dobles por dentro, como en el ejemplo |
| `--output table` se corta en Windows | Usa `--output text` o amplía la ventana |

## Cierre

### Checklist de verificación (por equipo)

También en [checklist.md](checklist.md).

Marca cada punto solo cuando **todos** los integrantes lo hayan completado.

- [ ] Entro a la consola con mi usuario; `aws login` funciona y `aws sts get-caller-identity` muestra `user/<mi usuario>`
- [ ] La misma identidad aparece en la consola (arriba a la derecha), en la CLI y en `node scripts/sdk/quien-soy.js`
- [ ] `.env` completo y `npm run verify` sin ❌
- [ ] Sabemos cuántas zonas tiene us-east-1 y qué diferencia hay entre `ZoneName` y `ZoneId`
- [ ] Bucket `crediflow-<usuario>-lab1-<cuenta>` con un objeto; bloqueo de acceso público activo
- [ ] Rol `crediflow-<usuario>-lab1-lector` con política inline de solo lectura y trust policy con mi usuario
- [ ] Asumimos el rol: `aws s3 ls` funcionó y `aws s3 cp` devolvió `AccessDenied`
- [ ] Podemos nombrar los cuatro elementos del error: identidad, acción, recurso y causa
- [ ] Volvimos a nuestra identidad de usuario
- [ ] Sabemos dónde ver el crédito restante de la cuenta (Billing → Free Tier)
- [ ] Estimación de la calculadora para la sesión 2 anotada: ____ USD/mes
- [ ] CrediFlow corre localmente: solicitud creada desde la web y desde la CLI
- [ ] Clasificamos las tareas de responsabilidad compartida y propusimos una práctica por pilar

### Limpieza de hoy

Borra solo los archivos locales que creaste (no tienen secretos, pero no se suben al repositorio): `hola.txt`, `politica.json`, `trust.json`. **No borres** el bucket ni el rol: se usan de ejemplo en la sesión 2 y se limpian juntos. Ninguno cuesta dinero mientras exista (el bucket tiene un archivo de 20 bytes).

### Para la sesión 2

- Leer la [guía de la sesión 2](../sesion-02/guia-laboratorio.md), partes A y B.
- Instalar el **Session Manager plugin** de AWS (Mac: `brew install --cask session-manager-plugin`; Windows: instalador en la documentación de AWS Systems Manager).
- Al llegar a la sesión 2, lo primero será `aws login --profile crediflow`: la sesión de hoy habrá expirado.
- Dudas al canal del curso; no esperes a la próxima clase.

### Reto para casa (opcional, 30-45 min)

También en [reto.md](reto.md); prompts en [prompts.md](prompts.md).

**Objetivo.** Hacer más estricta la política del rol lector: (1) solo puede leer objetos bajo el prefijo `reportes/`; (2) solo acepta llamadas por HTTPS; (3) deja de funcionar después de una fecha que tú elijas.

**Cómo.** Edita `politica.json`: separa `s3:ListBucket` (recurso = el bucket, con condición `s3:prefix` = `reportes/*`) de `s3:GetObject` (recurso = `arn:aws:s3:::<bucket>/reportes/*`). Agrega un bloque `Condition` con `"Bool": {"aws:SecureTransport": "true"}` y `"DateLessThan": {"aws:CurrentTime": "2026-12-31T23:59:59Z"}`. Actualiza el rol con el mismo nombre de política para reemplazarla:

```bash
aws iam put-role-policy --role-name $ROL --policy-name lectura-s3 --policy-document file://politica.json
```

**Cómo comprobar.** En **IAM → Policy Simulator**, selecciona el rol y prueba `s3:GetObject` sobre `arn:aws:s3:::<bucket>/reportes/x.txt` (debe permitir) y sobre `arn:aws:s3:::<bucket>/hola.txt` (debe denegar). Luego sube un objeto a `reportes/` con tu usuario, asume el rol (bloque C3) y léelo con `aws s3 cp s3://$BUCKET/reportes/x.txt -`; intenta leer `hola.txt` y observa el `AccessDenied`. Vuelve a tu identidad (C5).

**Qué entregas.** En el canal del curso: tu `politica.json` final y una captura del simulador con un permitido y un denegado. Si usaste IA, cuenta qué le pediste y qué tuviste que corregir (los prompts están en la lámina "Usa la IA para el reto" y en `docs/sesion-01/prompts.md`). Reemplaza el ID de cuenta, el nombre del bucket y los correos por valores ficticios si usas una IA pública.

**Bonus.** Si activaste MFA en el bloque A, agrega a `trust.json` la condición `"Bool": {"aws:MultiFactorAuthPresent": "true"}` y actualiza el rol con `aws iam update-assume-role-policy`. Intenta asumirlo desde la CLI: ¿funciona o no? Averigua con `aws sts get-caller-identity` y la documentación de `aws login` si las credenciales que recibe la CLI conservan la marca de MFA de tu sesión de consola, y escribe en el canal lo que encontraste.
