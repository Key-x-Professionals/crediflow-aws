# Sesión 2 · Laboratorio: red, datos y un servidor, a mano

## Cómo usar esta guía

**Duración:** 100 minutos efectivos más un receso de 10 minutos después del bloque B. **Equipos de 3-4 personas:** cada uno ejecuta en su propia terminal; el equipo llena un solo documento y valida el checklist al final. **Entregable:** la API de CrediFlow respondiendo desde un servidor EC2 con datos en RDS, el frontend conectado, el documento `despliegue-manual-<equipo>.md` y **todo destruido antes de salir**.

Convención: los bloques `bash` son para **Mac**; los bloques `powershell` para **Windows (PowerShell 7)**. Si solo hay un bloque, el comando es igual en ambos. Trabaja siempre dentro de la carpeta del repositorio (`cd crediflow`).

Hoy todo se crea con la **CLI** y se verifica en la **consola**. Es a propósito: los comandos están agrupados por pasos en un script (`scripts/manual/despliegue-manual.sh` en Mac, `.ps1` en Windows) para que no pierdas tiempo tecleando, pero **abre el script y lee cada paso antes de ejecutarlo**: cada línea es un comando que ya sabrías escribir. Al contar cuántos son y cuántos identificadores hay que recordar, vas a entender qué problema resuelve la infraestructura como código en la sesión 3.

Los cinco bloques y su "listo cuando":

| Bloque | Qué haces | Listo cuando |
|---|---|---|
| A · Red | Creas la VPC, cuatro subredes en dos zonas y dos security groups | El mapa de recursos muestra 4 subredes y `sg-db` solo acepta a `sg-app` |
| B · Datos | Creas el bucket, el secreto y la base RDS, y subes el código | RDS está *Available* y `api.zip` está en el bucket |
| C · Servidor | Lanzas la EC2 con su rol y su user data, y entras sin SSH | `/health` responde `ok` con `storage: postgres` |
| D · Probar | Creas solicitudes, reinicias el servicio y conectas la web | Los datos sobreviven al reinicio y la web los muestra |
| E · Operar y destruir | Haces una operación básica, cierras el documento y limpias | La búsqueda por la etiqueta `ManagedBy=manual` devuelve vacío |

> **Costo de hoy.** Una EC2 `t3.micro` y una RDS `db.t4g.micro` durante tres horas cuestan unos 11 centavos de dólar por persona. Olvidadas un mes, unos 26 dólares por persona, del crédito que comparte todo el grupo. Por eso el bloque E no es opcional.

## Antes de empezar

La sesión de la semana pasada ya expiró. Inicia sesión, ponte en el punto de partida de hoy y carga tus variables:

```bash
# Mac
aws login --profile crediflow
git checkout a02-inicio            # punto de partida de la sesión 2
npm install
source ./scripts/mac/load-env.sh
```
```powershell
# Windows
aws login --profile crediflow
git checkout a02-inicio
npm install
. .\scripts\windows\load-env.ps1
```

`load-env` termina mostrando tu identidad (`…:user/<tu usuario>`). Si en lugar de eso ves "Sin sesión", repite `aws login`. Comprueba además que instalaste el plugin de Session Manager (lo vas a necesitar en el bloque C):

```bash
session-manager-plugin
```

Debe responder *The Session Manager plugin was installed successfully*. Si no, instálalo ahora (Mac: `brew install --cask session-manager-plugin`; Windows: instalador en la documentación de AWS Systems Manager).

Por último, abre el documento de evidencia del equipo. Una persona copia la plantilla y la comparte:

```bash
cp docs/plantillas/despliegue-manual.md docs/sesion-02/despliegue-manual-<equipo>.md
```

Se llena **durante** el laboratorio: cada vez que termines un bloque, anota qué se creó, cuántos comandos fueron y qué te costó trabajo.

## Bloque A · Red (20 min)

Vas a construir la red donde vivirá CrediFlow:

```
VPC 10.1.0.0/16
├── public-a   10.1.0.0/24   (zona a)  ← aquí irá la EC2, con IP pública
├── public-b   10.1.1.0/24   (zona b)
├── private-a  10.1.10.0/24  (zona a)  ← aquí irá RDS
└── private-b  10.1.11.0/24  (zona b)  ← la exige el grupo de subredes de RDS
Internet gateway + una tabla de rutas con 0.0.0.0/0 → gateway, asociada solo a las públicas
```

### A1. Crea la VPC, las subredes y la ruta a internet

```bash
./scripts/manual/despliegue-manual.sh red          # Mac
```
```powershell
.\scripts\manual\despliegue-manual.ps1 red         # Windows
```

Mientras corre, abre el script en VS Code y busca `paso_red` (Mac) o `Paso-Red` (Windows). Verás, en orden: `create-vpc`, cuatro `create-subnet`, `create-internet-gateway`, `attach-internet-gateway`, `create-route-table`, `create-route` y dos `associate-route-table`, más un `create-tags` por recurso. El script guarda cada identificador en `scripts/manual/estado.out` porque el paso siguiente los necesita:

```bash
cat scripts/manual/estado.out          # Windows: Get-Content scripts\manual\estado.out
```

Anota en el documento del equipo: ¿cuántos comandos hicieron falta solo para la red? ¿Cuántos identificadores hay que recordar?

### A2. Mírala en la consola

**VPC → Your VPCs** → `crediflow-<tu usuario>-manual-vpc` → pestaña **Resource map**. Debes ver cuatro subredes repartidas en dos zonas, dos tablas de rutas (la que creaste y la principal, que la VPC trae de fábrica) y un internet gateway. Sigue las líneas: solo las dos subredes públicas llegan al gateway. **Eso** es lo que las hace públicas; las privadas usan la tabla principal, que no tiene salida a internet.

Compruébalo también por CLI:

```bash
# Mac
source scripts/manual/estado.out
aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC_ID --query 'Subnets[].[Tags[?Key==`Name`].Value|[0],CidrBlock,AvailabilityZone,MapPublicIpOnLaunch]' --output table
aws ec2 describe-route-tables --route-table-ids $RT_ID --query 'RouteTables[0].Routes[].[DestinationCidrBlock,GatewayId]' --output table
```
```powershell
# Windows
Get-Content scripts\manual\estado.out | ForEach-Object { $k,$v = $_ -split '=',2; Set-Item "env:$k" $v }
aws ec2 describe-subnets --filters "Name=vpc-id,Values=$env:VPC_ID" --query 'Subnets[].[Tags[?Key==`Name`].Value|[0],CidrBlock,AvailabilityZone,MapPublicIpOnLaunch]' --output table
aws ec2 describe-route-tables --route-table-ids $env:RT_ID --query 'RouteTables[0].Routes[].[DestinationCidrBlock,GatewayId]' --output table
```

La tabla de rutas muestra dos destinos: `10.1.0.0/16 → local` (todo lo de la VPC se ve entre sí) y `0.0.0.0/0 → igw-…` (el resto, a internet).

### A3. Los dos security groups

```bash
./scripts/manual/despliegue-manual.sh seguridad          # Mac
```
```powershell
.\scripts\manual\despliegue-manual.ps1 seguridad         # Windows
```

Crea dos grupos:

- `sg-app`, para el servidor: entrada TCP 80 desde internet (o desde `CF_ALLOWED_CIDR` si lo definiste en tu `.env`).
- `sg-db`, para la base de datos: entrada TCP 5432 **solo desde `sg-app`**. La regla no nombra una dirección IP: nombra a otro security group.

Verifica en la consola: **EC2 → Security Groups** → `…-manual-sg-db` → **Inbound rules**. En la columna *Source* no hay una IP: está el identificador de `sg-app`.

**Discute en equipo (2 min):** no abrimos el puerto 22 (SSH) en ningún grupo. ¿Cómo vamos a entrar al servidor si algo falla? (La respuesta llega en el bloque C.)

✅ **Listo cuando:** el mapa de recursos muestra cuatro subredes en dos zonas, solo las públicas tienen ruta al gateway y la regla de `sg-db` tiene como origen a `sg-app`.

## Bloque B · Datos (25 min, de los cuales RDS tarda entre 6 y 8)

### B1. Bucket, contraseña, base de datos y secreto

```bash
./scripts/manual/despliegue-manual.sh datos          # Mac
```
```powershell
.\scripts\manual\despliegue-manual.ps1 datos         # Windows
```

El paso hace cinco cosas, en este orden:

1. Crea el bucket `crediflow-<tu usuario>-manual-<cuenta>`, con el acceso público bloqueado y cifrado por defecto.
2. Pide a AWS una contraseña aleatoria de 24 caracteres (`secretsmanager get-random-password`). No aparece en pantalla y nadie la elige.
3. Crea el *DB subnet group* con las dos subredes privadas: le dice a RDS en qué subredes puede vivir.
4. Lanza la instancia `db.t4g.micro` con PostgreSQL 16: cifrada, **no pública**, con `sg-db`, sin Multi-AZ y sin respaldos automáticos (va a vivir tres horas).
5. Cuando RDS queda disponible, guarda `host`, `port`, `dbname`, `username` y `password` en el secreto `crediflow/<tu usuario>/manual/db`.

La terminal se queda esperando en "Esperando a que RDS esté disponible". **No la cierres.** Aprovecha la espera:

- En la consola, **RDS → Databases**: tu instancia en estado *Creating*. Entra y mira la pestaña **Connectivity & security**: *Publicly accessible: No*, las subredes privadas y `sg-db`.
- **Discute en equipo:** cuando el secreto exista, ¿quién podrá leerlo? (Pista: el rol que crearás en el bloque C. ¿Y las personas con acceso a la cuenta?)

### B2. El código viaja por S3

Abre **una segunda terminal** (deja la primera esperando a RDS), carga el entorno otra vez y ejecuta:

```bash
# Mac
source ./scripts/mac/load-env.sh
./scripts/manual/despliegue-manual.sh codigo
```
```powershell
# Windows
. .\scripts\windows\load-env.ps1
.\scripts\manual\despliegue-manual.ps1 codigo
```

Empaqueta `apps/api` (el código fuente, sin `node_modules`) en `api.zip` y lo sube a `s3://<bucket>/releases/api.zip`. El servidor lo descargará al arrancar. Compruébalo:

```bash
aws s3 ls s3://$BUCKET/releases/          # Windows: s3://$env:BUCKET/releases/
```

(`BUCKET` está en `estado.out`; vuelve a cargarlo como en A2 si la variable está vacía.)

En la consola, **S3 → tu bucket → Properties**: *Default encryption: SSE-S3*; pestaña **Permissions**: *Block all public access: On*.

### B3. Cuando RDS termine

La primera terminal imprime `✅ Datos listos`. Mira el secreto **sin mostrar la contraseña**:

```bash
aws secretsmanager describe-secret --secret-id crediflow/$CF_STUDENT/manual/db --query '[Name,CreatedDate]'
aws secretsmanager get-secret-value --secret-id crediflow/$CF_STUDENT/manual/db --query SecretString --output text | node -pe 'Object.keys(JSON.parse(require("fs").readFileSync(0)))'
```
```powershell
aws secretsmanager describe-secret --secret-id "crediflow/$env:CF_STUDENT/manual/db" --query '[Name,CreatedDate]'
(aws secretsmanager get-secret-value --secret-id "crediflow/$env:CF_STUDENT/manual/db" --query SecretString --output text | ConvertFrom-Json).PSObject.Properties.Name
```

El segundo comando lista solo los **nombres** de los campos (`host`, `port`, `dbname`, `username`, `password`). Nunca copies ni pegues el valor completo del secreto, y menos en una IA.

✅ **Listo cuando:** RDS aparece como *Available*, el secreto existe y `api.zip` está en el bucket. Ahora, **receso de 10 minutos** (si RDS aún no termina, déjala trabajando y sal igual).

## Bloque C · Servidor (20 min)

### C1. Rol, instancia y user data

```bash
./scripts/manual/despliegue-manual.sh servidor          # Mac
```
```powershell
.\scripts\manual\despliegue-manual.ps1 servidor         # Windows
```

Lee el paso en el script mientras corre. Hace tres cosas:

1. Crea el rol `crediflow-<tu usuario>-manual-ec2-role` con **mínimo privilegio**: la política administrada `AmazonSSMManagedInstanceCore` (para Session Manager) y una política propia que permite leer y escribir **solo en tu bucket** y leer **solo tu secreto**. Es el mismo patrón del rol lector de la sesión 1, ahora para una máquina.
2. Busca la imagen (AMI) de Amazon Linux 2023 en un parámetro público de AWS, en lugar de usar un identificador copiado de internet.
3. Lanza una `t3.micro` en `public-a`, con `sg-app`, el rol, el servicio de metadatos en modo seguro (`HttpTokens=required`, IMDSv2) y el *user data* `scripts/manual/user-data.sh`.

Abre `scripts/manual/user-data.sh`: es lo que el servidor ejecuta, como root, la primera vez que arranca. Instala Node 22, baja `api.zip` de S3, compila, lee el secreto con el rol de la instancia y deja la API como servicio (`systemd`) en el puerto 80. Si quieres entenderlo línea por línea, usa el prompt 2.4 de `docs/sesion-02/prompts.md`.

### C2. Espera y verifica

La instalación tarda unos dos minutos después de que la instancia arranca:

```bash
./scripts/manual/despliegue-manual.sh verificar          # Mac
```
```powershell
.\scripts\manual\despliegue-manual.ps1 verificar         # Windows
```

Respuesta esperada:

```json
{"status":"ok","storage":"postgres","database":"ok","queue":"not-configured", ...}
```

Si dice que todavía no responde, espera un minuto y repite. Si pasa de tres minutos, o responde `"status":"degraded"`, no adivines: entra al servidor.

### C3. Entra al servidor sin SSH

```bash
# Mac
source scripts/manual/estado.out
aws ssm start-session --target $INSTANCE_ID
```
```powershell
# Windows
aws ssm start-session --target $env:INSTANCE_ID
```

Estás dentro de la EC2, sin llave y sin puerto 22. Mira qué pasó en la instalación y cómo está el servicio:

```bash
sudo tail -n 40 /var/log/crediflow-user-data.log     # la salida del user data
sudo systemctl status crediflow-api --no-pager        # el servicio
sudo journalctl -u crediflow-api -n 20 --no-pager     # los logs de la API (una línea JSON por evento)
curl -s localhost/health
exit
```

En la consola: **EC2 → Instances** → tu instancia → pestaña **Security** (el rol y `sg-app`) y **Systems Manager → Session Manager → Session history**: ahí está registrado quién entró y cuándo.

✅ **Listo cuando:** `/health` responde `"status":"ok"` con `"storage":"postgres"` desde tu máquina y entraste al servidor con Session Manager.

Si algo falla:

| Síntoma | Qué revisar |
|---|---|
| `curl` no responde nunca | ¿La instancia tiene IP pública? ¿`sg-app` permite el 80? ¿Tu red bloquea HTTP (prueba con el celular)? |
| `"database":"unavailable"` o `degraded` | En el servidor: `journalctl` muestra el error. Casi siempre RDS aún no estaba lista al arrancar: `sudo systemctl restart crediflow-api` |
| `start-session` falla con *TargetNotConnected* | Espera un minuto (el agente tarda en registrarse) o revisa que el rol tenga `AmazonSSMManagedInstanceCore` |
| `SessionManagerPlugin is not found` | Falta instalar el plugin en tu máquina |

## Bloque D · Probar (15 min)

### D1. Crea solicitudes contra RDS

```bash
# Mac
curl -s -X POST http://$PUBLIC_IP/solicitudes -H "Content-Type: application/json" \
  -d '{"nombre":"Ana Pérez","documento":"01234567-8","monto":5000,"plazoMeses":24,"ingresoMensual":1200,"proposito":"consumo"}'
curl -s http://$PUBLIC_IP/solicitudes
```
```powershell
# Windows
Invoke-RestMethod -Method Post -Uri "http://$env:PUBLIC_IP/solicitudes" -ContentType "application/json" `
  -Body '{"nombre":"Ana Pérez","documento":"01234567-8","monto":5000,"plazoMeses":24,"ingresoMensual":1200,"proposito":"consumo"}'
Invoke-RestMethod "http://$env:PUBLIC_IP/solicitudes"
```

### D2. Reinicia y comprueba que los datos siguen ahí

Entra con Session Manager, reinicia la API y sal:

```bash
aws ssm start-session --target $INSTANCE_ID          # Windows: $env:INSTANCE_ID
sudo systemctl restart crediflow-api
exit
```

Vuelve a listar las solicitudes: **siguen ahí**. En la sesión 1 se habrían perdido, porque vivían en la memoria del proceso; ahora viven en PostgreSQL. El servidor puede reiniciarse, o cambiarse por otro, sin perder nada: el servidor no guarda estado. Esa idea vuelve en la sesión 4.

### D3. Conecta el frontend

Edita `apps/web/.env.local` con la dirección de tu servidor y arranca la web:

```ini
NEXT_PUBLIC_API_URL=http://<PUBLIC_IP>
NEXT_PUBLIC_STUDENT=<tu usuario>
```

```bash
cd apps/web && npm run dev
```

Abre `http://localhost:3001`. En **Estado**, la tarjeta de la API en verde con `storage: postgres` y el nombre de tu EC2 como host. Crea una solicitud desde la web y compruébala con `curl`. La página corre en tu máquina; los datos ya están en AWS. Detén la web con `Ctrl+C` y vuelve a la raíz del repositorio (`cd ../..`).

✅ **Listo cuando:** creaste solicitudes, sobrevivieron al reinicio del servicio y la web las muestra.

## Bloque E · Operar y destruir (20 min)

### E1. Una operación básica (elige una, 5 min)

**Opción 1 · Diagnóstico de conectividad.** Quita temporalmente la regla que deja pasar a la aplicación hacia la base de datos, observa el efecto y restáurala. Antes de tocar nada, usa el prompt 2.2 para pedirle a la IA un plan de comprobaciones.

```bash
# Mac
aws ec2 revoke-security-group-ingress --group-id $SG_DB --protocol tcp --port 5432 --source-group $SG_APP
curl -s http://$PUBLIC_IP/health            # ¡sigue en "ok"!
```
```powershell
# Windows
aws ec2 revoke-security-group-ingress --group-id $env:SG_DB --protocol tcp --port 5432 --source-group $env:SG_APP
Invoke-RestMethod "http://$env:PUBLIC_IP/health"
```

¿Por qué sigue funcionando? El security group tiene estado: las conexiones que la API **ya tenía abiertas** con la base siguen vivas; la regla solo se evalúa al abrir conexiones nuevas. Fuerza conexiones nuevas reiniciando la API por Session Manager (`sudo systemctl restart crediflow-api`) y repite el `curl`: ahora responde `"status":"degraded"` con `"database":"unavailable"`. Restaura la regla, reinicia otra vez y comprueba que vuelve a `ok`:

```bash
aws ec2 authorize-security-group-ingress --group-id $SG_DB --protocol tcp --port 5432 --source-group $SG_APP     # Windows: $env:SG_DB, $env:SG_APP
```

**Opción 2 · Snapshot de la base de datos.** Crea un respaldo manual y míralo en **RDS → Snapshots**:

```bash
aws rds create-db-snapshot --db-instance-identifier crediflow-$CF_STUDENT-manual-db --db-snapshot-identifier crediflow-$CF_STUDENT-manual-snap1
```

(Windows: `$env:CF_STUDENT`.) Si eliges esta, bórralo antes de limpiar: `aws rds delete-db-snapshot --db-snapshot-identifier crediflow-<tu usuario>-manual-snap1` (hay que esperar a que termine de crearse).

**Opción 3 · Métricas del servidor.** En la consola, **EC2 → tu instancia → Monitoring**: CPU, red y créditos de CPU de los últimos minutos. ¿Se nota el momento de la instalación?

### E2. Cierra el documento del equipo (5 min)

Completa `despliegue-manual-<equipo>.md`: lista de recursos con sus nombres, número total de comandos, tiempo invertido y **tres dolores** del proceso manual (lo que fue lento, lo que fue fácil de equivocar, lo que no podrías repetir igual mañana). Compara además con la estimación de costo que anotaron en la sesión 1. Si quieren un diagrama, peguen las notas en el prompt 2.3. Este documento es el punto de partida de la sesión 3.

### E3. Destruye todo (10 min; RDS tarda unos 5)

```bash
./scripts/manual/despliegue-manual.sh limpiar          # Mac
```
```powershell
.\scripts\manual\despliegue-manual.ps1 limpiar         # Windows
```

Borra en orden inverso: instancia, rol, base de datos, secreto, bucket, security groups, subredes, tabla de rutas, gateway y VPC. Fíjate en que el orden importa también para destruir: no se puede borrar una VPC que todavía tiene algo dentro.

Limpia también lo que quedó de la sesión 1 (el bucket y el rol lector):

```bash
# Mac
aws s3 rb s3://crediflow-$CF_STUDENT-lab1-$CDK_DEFAULT_ACCOUNT --force
aws iam delete-role-policy --role-name crediflow-$CF_STUDENT-lab1-lector --policy-name lectura-s3
aws iam delete-role --role-name crediflow-$CF_STUDENT-lab1-lector
```
```powershell
# Windows
aws s3 rb "s3://crediflow-$env:CF_STUDENT-lab1-$env:CDK_DEFAULT_ACCOUNT" --force
aws iam delete-role-policy --role-name "crediflow-$env:CF_STUDENT-lab1-lector" --policy-name lectura-s3
aws iam delete-role --role-name "crediflow-$env:CF_STUDENT-lab1-lector"
```

### E4. Comprueba que no quedó nada

```bash
aws resourcegroupstaggingapi get-resources --tag-filters Key=ManagedBy,Values=manual Key=Student,Values=$CF_STUDENT --query 'ResourceTagMappingList[].ResourceARN'
npm run costos
```

(Windows: `Values=$env:CF_STUDENT`.) El primer comando debe devolver `[]` (algunos recursos tardan un par de minutos en desaparecer de la lista; repite si hace falta). `npm run costos` lista lo que tienes con tu etiqueta y marca lo que cobra por hora: no debe marcar nada.

✅ **Listo cuando:** la búsqueda por etiqueta devuelve vacío y `npm run costos` no marca ningún recurso por hora.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `CF_STUDENT: unbound variable` o variables vacías | No cargaste el entorno en esta terminal: `source ./scripts/mac/load-env.sh` o `. .\scripts\windows\load-env.ps1` |
| `ExpiredToken` / `Unable to locate credentials` | `aws login --profile crediflow` |
| `VpcLimitExceeded` al crear la VPC | La cuenta llegó al máximo de VPC: avisa al instructor (se trabaja una VPC por equipo mientras se amplía la cuota) |
| `InvalidGroup.Duplicate` o `already exists` | Ejecutaste un paso dos veces. Corre `limpiar` y empieza de nuevo desde `red` |
| El paso `datos` falla a la mitad | Corre `limpiar` (ignora los errores de lo que no existe) y repite desde `red` |
| `AccessDenied` al crear el rol | El nombre debe empezar con `crediflow-`: revisa que `CF_STUDENT` en tu `.env` sea tu usuario |
| `/health` responde pero `storage: memory` | El user data no pudo leer el secreto: entra por Session Manager y lee `/var/log/crediflow-user-data.log` |
| La web dice que no hay conexión | `NEXT_PUBLIC_API_URL` debe ser `http://` (no https) y la IP actual de la instancia; reinicia `npm run dev` |
| `limpiar` deja la VPC | RDS aún se estaba borrando. Espera cinco minutos y repite `limpiar` |
| PowerShell no ejecuta el `.ps1` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` y usa PowerShell 7 (`pwsh`) |

## Cierre

### Checklist de verificación (por equipo)

Marca cada punto solo cuando **todos** los integrantes lo hayan completado.

- [ ] VPC `crediflow-<usuario>-manual-vpc` con cuatro subredes en dos zonas; solo las públicas tienen ruta a `0.0.0.0/0`
- [ ] Podemos explicar qué hace pública a una subred y la diferencia entre security group y network ACL
- [ ] `sg-db` solo acepta el puerto 5432 desde `sg-app`; ningún grupo abre el 22
- [ ] RDS PostgreSQL cifrada, no pública, en subredes privadas
- [ ] La contraseña vive solo en Secrets Manager; nadie la vio ni la escribió
- [ ] El rol de la EC2 solo puede leer **su** secreto y **su** bucket
- [ ] `/health` respondió `ok` con `storage: postgres`; entramos al servidor con Session Manager
- [ ] Creamos solicitudes, reiniciamos el servicio y los datos persistieron; la web quedó conectada
- [ ] Hicimos una operación básica (diagnóstico, snapshot o métricas)
- [ ] Documento `despliegue-manual-<equipo>.md` con recursos, número de comandos, tiempo y tres dolores
- [ ] **Todo destruido:** la búsqueda por `ManagedBy=manual` devuelve vacío y `npm run costos` no marca nada por hora
- [ ] Bucket y rol del laboratorio 1 eliminados

### Limpieza de hoy

Además de los recursos de AWS (bloque E), borra los archivos locales que no se suben al repositorio: `scripts/manual/estado.out`, `scripts/manual/api.zip` y `scripts/manual/user-data.rendered.out` (el paso `limpiar` ya lo hace). Conserva el documento del equipo.

### Para la sesión 3

- Ten una cuenta de **GitHub** (personal o de trabajo) e instala la CLI de GitHub: `brew install gh` (Mac) o `winget install --id GitHub.cli -e` (Windows). Comprueba con `gh --version`.
- Lee `infra/lib/constructs/crediflow-vpc.ts` y compáralo con el paso `red` del script de hoy: son las mismas decisiones, escritas una sola vez.
- Trae el documento del equipo: la sesión 3 empieza con sus tres dolores.
- Dudas al canal del curso; no esperes a la próxima clase.

### Reto para casa (opcional, 30-40 min, sin costo)

**Objetivo.** Un bucket que (1) rechaza cualquier petición que no llegue por HTTPS y (2) guarda las versiones anteriores de cada objeto, de modo que puedas recuperar un archivo borrado.

**Cómo.** Crea el bucket y aplícale una política con un `Deny` cuando `aws:SecureTransport` sea `false`; después activa el versionado:

```bash
# Mac
export RETO=crediflow-$CF_STUDENT-reto2-$CDK_DEFAULT_ACCOUNT
aws s3 mb s3://$RETO
cat > politica-https.json <<EOF
{"Version":"2012-10-17","Statement":[{"Sid":"SoloHTTPS","Effect":"Deny","Principal":"*","Action":"s3:*",
  "Resource":["arn:aws:s3:::$RETO","arn:aws:s3:::$RETO/*"],
  "Condition":{"Bool":{"aws:SecureTransport":"false"}}}]}
EOF
aws s3api put-bucket-policy --bucket $RETO --policy file://politica-https.json
aws s3api put-bucket-versioning --bucket $RETO --versioning-configuration Status=Enabled
echo "version 1" > doc.txt && aws s3 cp doc.txt s3://$RETO/doc.txt
echo "version 2" > doc.txt && aws s3 cp doc.txt s3://$RETO/doc.txt
aws s3 rm s3://$RETO/doc.txt
```

En Windows usa `$env:RETO = "crediflow-$env:CF_STUDENT-reto2-$env:CDK_DEFAULT_ACCOUNT"`, escribe el JSON en `politica-https.json` con VS Code (reemplazando el nombre del bucket) y los mismos comandos con `$env:RETO`.

**Cómo comprobar.** Primero, que HTTP queda rechazado y HTTPS no:

```bash
aws s3 ls s3://$RETO --endpoint-url http://s3.us-east-1.amazonaws.com     # AccessDenied
aws s3 ls s3://$RETO                                                       # funciona (vacío: borraste el archivo)
```

Después, que el archivo se puede recuperar. Lista las versiones: verás dos versiones de `doc.txt` y una **marca de borrado** (*delete marker*). Borrar la marca "des-borra" el objeto:

```bash
aws s3api list-object-versions --bucket $RETO --query '{Versiones:Versions[].[Key,VersionId,IsLatest],Marcas:DeleteMarkers[].[Key,VersionId]}'
aws s3api delete-object --bucket $RETO --key doc.txt --version-id <VersionId de la marca>
aws s3 cp s3://$RETO/doc.txt -                                             # imprime "version 2"
```

**Qué entregas.** En el canal del curso: tu `politica-https.json` y una captura con el `AccessDenied` por HTTP y con el archivo recuperado. Si usaste IA, cuenta qué le pediste y qué tuviste que corregir.

**Limpieza del reto.** Un bucket con versionado no se vacía con `rb --force`: hay que borrar todas las versiones y marcas. Lo más simple es desde la consola (**S3 → tu bucket → Empty**, y luego **Delete**), o por CLI:

```bash
aws s3api delete-objects --bucket $RETO --delete "$(aws s3api list-object-versions --bucket $RETO --query '{Objects: [Versions,DeleteMarkers][][].{Key:Key,VersionId:VersionId}}' --output json)"
aws s3 rb s3://$RETO
```

**Bonus.** Agrega una regla de ciclo de vida que elimine las versiones no vigentes a los 7 días (`aws s3api put-bucket-lifecycle-configuration`). ¿Por qué conviene tenerla siempre que se activa el versionado?
