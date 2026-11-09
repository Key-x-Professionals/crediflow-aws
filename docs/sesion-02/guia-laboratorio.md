# Sesión 2 · Laboratorio: CrediFlow "a mano" con VPC, EC2, S3 y RDS

**Duración:** 110 min · **Entregable:** la API de CrediFlow respondiendo desde una EC2 con base de datos en RDS, el frontend conectado, y el documento `despliegue-manual.md` del equipo.

> Hoy se crea todo con la **CLI** y se verifica en la **consola**. Es intencional: al documentar cada paso vas a entender exactamente qué problema resuelve CDK en la sesión 3.

Los scripts `scripts/manual/despliegue-manual.sh` (Mac) y `.ps1` (Windows) contienen todos los comandos agrupados por paso. **Ábrelos y lee cada bloque antes de ejecutarlo**; la guía explica qué hace cada uno.

Prepara la terminal:

```bash
# Mac
source ./scripts/mac/load-env.sh
```
```powershell
# Windows
. .\scripts\windows\load-env.ps1
```

Y en paralelo, abre el documento de evidencia: copia `docs/plantillas/despliegue-manual.md` a `docs/sesion-02/despliegue-manual-<equipo>.md`.

---

## Parte A · Red (15 min)

Lo que vas a construir:

```
VPC 10.1.0.0/16
├── public-a  10.1.0.0/24  (AZ a)  ← EC2 con IP pública
├── public-b  10.1.1.0/24  (AZ b)
├── private-a 10.1.10.0/24 (AZ a)  ← RDS
└── private-b 10.1.11.0/24 (AZ b)  ← RDS (standby, requisito del subnet group)
Internet Gateway + tabla de rutas 0.0.0.0/0 → IGW (solo subredes públicas)
```

```bash
./scripts/manual/despliegue-manual.sh red          # Mac
```
```powershell
.\scripts\manual\despliegue-manual.ps1 red         # Windows
```

Mientras corre, lee el paso `paso_red` del script y anota en el documento: ¿cuántos comandos hicieron falta? ¿Cuántos IDs hay que recordar?

**Verifica en la consola:** VPC → *Your VPCs* → `crediflow-<alumno>-manual-vpc` → *Resource map*. Debe mostrar 4 subredes, 1 tabla de rutas con el IGW.

**Verifica por CLI:**

```bash
aws ec2 describe-subnets --filters Name=vpc-id,Values=$VPC_ID --query 'Subnets[].[Tags[?Key==`Name`].Value|[0],CidrBlock,AvailabilityZone,MapPublicIpOnLaunch]' --output table
```
(Windows: `$env:VPC_ID`; carga el estado con `Get-Content scripts\manual\estado.out`)

---

## Parte B · Security groups (10 min)

```bash
./scripts/manual/despliegue-manual.sh seguridad
```

Dos grupos:

- `sg-app`: entrada TCP 80 desde `CF_ALLOWED_CIDR` (por defecto internet).
- `sg-db`: entrada TCP 5432 **solo desde `sg-app`** (referencia a otro grupo, no a una IP).

**Pregunta de equipo:** ¿por qué no abrimos el 22 (SSH)? Pista: Session Manager, parte E.

**Verifica en la consola:** EC2 → Security Groups → `sg-db` → *Inbound rules*: la fuente es el ID de `sg-app`.

---

## Parte C · Datos: S3, Secrets Manager y RDS (20 min, RDS tarda ~6 min)

```bash
./scripts/manual/despliegue-manual.sh datos
```

Qué hace:

1. Bucket privado y cifrado `crediflow-<alumno>-manual-<cuenta>`.
2. Contraseña aleatoria con `secretsmanager get-random-password` (nunca la verás en pantalla).
3. DB subnet group con las dos subredes privadas.
4. `db.t4g.micro` PostgreSQL 16, cifrada, **no pública**, sin Multi-AZ (costo).
5. Al terminar, guarda `host/port/dbname/username/password` en el secreto `crediflow/<alumno>/manual/db`.

Mientras RDS se crea, en la consola: RDS → Databases → estado *Creating*. Abre **Secrets Manager** y revisa el secreto cuando aparezca. Pregunta: ¿quién puede leerlo? (pista: parte E, rol de la EC2).

Aprovecha para la **parte D** mientras esperas.

---

## Parte D · El código viaja por S3 (5 min)

```bash
./scripts/manual/despliegue-manual.sh codigo
```

Empaqueta `apps/api` en `api.zip` y lo sube a `s3://<bucket>/releases/api.zip`. La EC2 lo descargará al arrancar.

```bash
aws s3 ls s3://$BUCKET/releases/
```

---

## 🔁 Receso (10 min) — RDS sigue creándose

---

## Parte E · Servidor: rol IAM, EC2 y user data (25 min)

```bash
./scripts/manual/despliegue-manual.sh servidor
```

Qué hace:

1. Rol `crediflow-<alumno>-manual-ec2-role` con **mínimo privilegio**: `AmazonSSMManagedInstanceCore` (Session Manager) + leer/escribir solo en TU bucket + leer solo TU secreto. Revisa la política inline en el script.
2. AMI de Amazon Linux 2023 obtenida de **SSM Parameter Store** (nunca un ID de AMI copiado de internet).
3. `t3.micro` en `public-a`, con `sg-app`, IMDSv2 obligatorio y el *user data* `scripts/manual/user-data.sh` que: instala Node 22, baja `api.zip`, compila, lee el secreto y arranca la API como servicio `systemd` en el puerto 80.

### E1. Esperar y verificar

```bash
./scripts/manual/despliegue-manual.sh verificar
# o directamente
curl http://$PUBLIC_IP/health
```
```powershell
Invoke-RestMethod http://$env:PUBLIC_IP/health
```

Respuesta esperada: `{"status":"ok","storage":"postgres","database":"ok","queue":"not-configured",...}`.

Si responde `degraded` o no responde, ve a E2.

### E2. Entrar al servidor SIN SSH: Session Manager

```bash
aws ssm start-session --target $INSTANCE_ID
```
```powershell
aws ssm start-session --target $env:INSTANCE_ID
```

Dentro del servidor:

```bash
sudo tail -n 50 /var/log/crediflow-user-data.log     # instalación
sudo systemctl status crediflow-api                   # servicio
sudo journalctl -u crediflow-api -n 30 --no-pager     # logs de la API (JSON estructurado)
curl -s localhost/health
exit
```

**Verifica en la consola:** EC2 → Instances → tu instancia → *Security* (rol y SG) → *Monitoring* (CPU). Systems Manager → *Session Manager* → historial de sesiones (auditoría de quién entró).

### E3. Crear solicitudes contra RDS

```bash
curl -s -X POST http://$PUBLIC_IP/solicitudes -H "Content-Type: application/json" \
  -d '{"nombre":"Ana Pérez","documento":"01234567-8","monto":5000,"plazoMeses":24,"ingresoMensual":1200,"proposito":"consumo"}'
curl -s http://$PUBLIC_IP/solicitudes
```
```powershell
Invoke-RestMethod -Method Post -Uri "http://$env:PUBLIC_IP/solicitudes" -ContentType "application/json" `
  -Body '{"nombre":"Ana Pérez","documento":"01234567-8","monto":5000,"plazoMeses":24,"ingresoMensual":1200,"proposito":"consumo"}'
Invoke-RestMethod "http://$env:PUBLIC_IP/solicitudes"
```

Reinicia la API (`sudo systemctl restart crediflow-api` por Session Manager) y vuelve a listar: los datos **persisten** porque están en RDS, no en memoria como en la sesión 1.

### E4. Conectar el frontend

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://<PUBLIC_IP>
NEXT_PUBLIC_STUDENT=<alumno>
```

`npm run dev` en `apps/web` → **Estado**: API en verde con `storage: postgres`, host = nombre de la EC2. Crea una solicitud desde la web.

✅ **Checkpoint E:** `/health` en verde desde internet, datos persistentes en RDS, frontend conectado.

---

## Parte F · Operaciones básicas (15 min)

Elige dos:

1. **Snapshot manual de RDS** (CLI) y verlo en la consola:
   ```bash
   aws rds create-db-snapshot --db-instance-identifier crediflow-$CF_STUDENT-manual-db --db-snapshot-identifier crediflow-$CF_STUDENT-manual-snap1
   ```
2. **Versionado en S3**: actívalo y sube dos versiones de un archivo; lista versiones.
   ```bash
   aws s3api put-bucket-versioning --bucket $BUCKET --versioning-configuration Status=Enabled
   echo v1 > doc.txt && aws s3 cp doc.txt s3://$BUCKET/docs/doc.txt && echo v2 > doc.txt && aws s3 cp doc.txt s3://$BUCKET/docs/doc.txt
   aws s3api list-object-versions --bucket $BUCKET --prefix docs/ --query 'Versions[].[VersionId,LastModified,IsLatest]' --output table
   ```
3. **Métricas**: CPU de la EC2 en los últimos 30 min por CLI.
   ```bash
   aws cloudwatch get-metric-statistics --namespace AWS/EC2 --metric-name CPUUtilization --dimensions Name=InstanceId,Value=$INSTANCE_ID \
     --start-time $(date -u -v-30M +%FT%TZ 2>/dev/null || date -u -d '30 min ago' +%FT%TZ) --end-time $(date -u +%FT%TZ) --period 300 --statistics Average
   ```
4. **Diagnóstico de conectividad**: quita temporalmente la regla 5432 de `sg-db`, llama a `/health` (debe pasar a `degraded`), y restáurala. Usa el prompt 2.2 para razonar antes de tocar nada.

---

## Cierre (10 min)

1. Completa el [checklist](checklist.md).
2. Termina `despliegue-manual-<equipo>.md`: lista de recursos, IDs, comandos, cuánto tardó, qué dolió. Compáralo con la estimación de costos de la sesión 1 (prompt 2.3 para generar el diagrama).
3. **Destruye todo lo creado hoy antes de irte** (RDS y EC2 cobran por hora aunque no se usen; en una cuenta con crédito limitado eso es dinero del curso): `./scripts/manual/despliegue-manual.sh limpiar` (Mac) o `.\scripts\manual\despliegue-manual.ps1 limpiar` (Windows). El documento `despliegue-manual-<equipo>.md` es la evidencia que compararemos en la sesión 3; RDS borrarse tarda ~5 min: lanza la limpieza y termina el documento mientras tanto.
4. Verifica que no quede nada: `aws resourcegroupstaggingapi get-resources --tag-filters Key=ManagedBy,Values=manual` debe devolver una lista vacía.
5. Trabajo asíncrono: [reto](reto.md) y leer `infra/lib/constructs/crediflow-vpc.ts` comparándolo con `paso_red`. Nota para la sesión 3: desde ahí CrediFlow guarda las solicitudes en **DynamoDB** (sin costo fijo, sin VPC ni secretos); hoy usaste RDS para conocer una base de datos relacional administrada, que es lo que la mayoría de sistemas bancarios usan.
