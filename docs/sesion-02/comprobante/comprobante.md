# Comprobante · Sesión 2 — Despliegue manual de CrediFlow

**Fecha:** 2026-11-17 · **Cuenta AWS:** 806379241890 (`arn:aws:iam::806379241890:user/edgar.velasco`) · **Región:** us-east-2
**Alumno:** edgar.velasco · **Perfil:** crediflow

Ejecución real de la guía completa (`scripts/manual/despliegue-manual.sh todo`), verificación por CLI y por navegador (Chrome), y destrucción total. Cada bloque incluye el comando y su salida real.

> Nota: las capturas del frontend se tomaron en vivo en Chrome durante esta sesión. La extensión de Chrome no expone los archivos de imagen al sistema de archivos, por lo que aquí se transcriben los valores exactos que mostró cada pantalla.

---

## Bloque A · Red

Comando: `./scripts/manual/despliegue-manual.sh red` + `seguridad`

Recursos creados (IDs reales de esta corrida):

```
VPC_ID=vpc-0c85355be72ba6afb
SUB_PUB1=subnet-075dc5c2fab3dd0e3   (public-a, 10.1.0.0/24, us-east-2a, MapPublicIpOnLaunch=true)
SUB_PUB2=subnet-0b8cf5f1a448e008d   (public-b, 10.1.1.0/24, us-east-2b)
SUB_PRIV1=subnet-0251b272da9dd0709  (private-a, 10.1.10.0/24, us-east-2a)
SUB_PRIV2=subnet-0eb6358fcd8491981  (private-b, 10.1.11.0/24, us-east-2b)
IGW_ID=igw-0b80861bdc3136d2e
RT_ID=rtb-0e6d3979f64532b95         (0.0.0.0/0 -> IGW, asociada solo a las públicas)
SG_APP=sg-07bf61bab77ad9bd2         (TCP 80 desde 0.0.0.0/0)
SG_DB=sg-0b9e4dacbcb403710          (TCP 5432 solo desde sg-app)
```

**Listo cuando:** 4 subredes en 2 zonas, solo las públicas con ruta al gateway, y la regla de `sg-db` con origen `sg-app`. ✅

---

## Bloque B · Datos

Comando: `./scripts/manual/despliegue-manual.sh datos` + `codigo`

```
BUCKET=crediflow-edgar-velasco-manual-806379241890   (SSE-S3, acceso público bloqueado)
DB_ID=crediflow-edgar-velasco-manual-db              (db.t4g.micro, PostgreSQL 16, cifrada, no pública, sg-db)
DB_HOST=crediflow-edgar-velasco-manual-db.c7agkoi0oey9.us-east-2.rds.amazonaws.com
DB_SECRET=crediflow/edgar.velasco/manual/db          (host, port, dbname, username, password)
api.zip -> s3://crediflow-edgar-velasco-manual-806379241890/releases/api.zip
```

**Listo cuando:** RDS `available`, secreto existe, `api.zip` en el bucket. ✅

---

## Bloque C · Servidor

Comando: `./scripts/manual/despliegue-manual.sh servidor` + `verificar`

```
ROLE=crediflow-edgar-velasco-manual-ec2-role   (AmazonSSMManagedInstanceCore + política mínima: su bucket + su secreto)
INSTANCE_ID=i-0161fb25102ad7641                (t3.micro, public-a, sg-app, IMDSv2, user-data)
PUBLIC_IP=18.189.157.161
```

`/health` desde la máquina local (puerto 80 vía sg-app):

```json
{"status":"ok","storage":"postgres","database":"ok","queue":"not-configured","startedAt":"2026-11-17T20:05:41.431Z","uptimeSeconds":202}
```

Acceso sin SSH verificado por Session Manager (SSM `send-command`): servicio `crediflow-api` = `active`.

**Listo cuando:** `/health` = `ok` con `storage:postgres` y entrada por Session Manager. ✅

---

## Bloque D · Probar

POST de una solicitud contra RDS:

```json
{"id":"07593749-0169-4615-9db9-f975d3ae9e4b","nombre":"Ana Pérez","documento":"01234567-8","monto":5000,"plazoMeses":24,"ingresoMensual":1200,"proposito":"consumo","estado":"RECIBIDA","creadaEn":"2026-11-17T20:06:01.250Z","actualizadaEn":"2026-11-17T20:06:01.250Z"}
```

Persistencia tras reinicio del servicio (`systemctl restart crediflow-api` por SSM → `active`), misma solicitud sobrevive (vive en PostgreSQL, no en memoria):

```json
[{"id":"07593749-0169-4615-9db9-f975d3ae9e4b","nombre":"Ana Pérez","monto":5000,"estado":"RECIBIDA","creadaEn":"2026-11-17T20:06:01.250Z"}]
```

### Frontend conectado (Chrome)

`apps/web/.env.local`:
```
NEXT_PUBLIC_API_URL=http://18.189.157.161
NEXT_PUBLIC_STUDENT=edgar.velasco
```
`npm run dev -w apps/web` → http://localhost:3001 (HTTP 200).

**Captura en vivo — pantalla "Estado de CrediFlow" (http://localhost:3001):**
- Tarjeta **API de solicitudes (contenedores)**: indicador **verde**
- `http://18.189.157.161`
- Almacenamiento: **postgres**
- Base de datos: **ok**
- Cola de evaluación: **sin configurar**
- Versión: **0.1.0**
- Alumno / entorno: **edgar.velasco / manual**
- Host: **local**

**Captura en vivo — pantalla "Solicitudes de crédito" (http://localhost:3001/solicitudes):**

| CLIENTE | MONTO | PLAZO | PROPÓSITO | ESTADO | CREADA |
|---|---|---|---|---|---|
| Ana Pérez | $5,000.00 | 24 meses | consumo | RECIBIDA | 17/11/2026, 2:06:01 p. m. |

La página corre local; el dato vive en AWS (RDS), servido por la API en la EC2.

**Listo cuando:** se crearon solicitudes, sobrevivieron al reinicio y la web las muestra. ✅

---

## Bloque E · Operar y destruir

Comando: `./scripts/manual/despliegue-manual.sh limpiar` (borra en orden inverso: instancia, rol, RDS, secreto, bucket, security groups, subredes, tabla de rutas, gateway, VPC). → `✅ Limpieza terminada`.

Verificación post-destrucción (cuenta 806379241890, us-east-2):

```
instancias vivas (running/pending/stopped) : (ninguna)
RDS                                          : (ninguna)
VPC no-default                               : (ninguna)
bucket crediflow                             : sin bucket
rol ...-manual                               : (ninguno)
secreto ...manual                            : (ninguno)
estado de i-0161fb25102ad7641                : terminated
```

`npm run costos`:
```
Recursos con etiqueta Student=edgar.velasco: 2   (instancias EC2 terminadas, aún en el índice ~1 h)
✅ No hay recursos con costo por hora (ALB, NAT, RDS, ECS, EC2) encendidos.
```

**Listo cuando:** la búsqueda por `ManagedBy=manual` se vacía (las instancias terminadas tardan ~1 h en salir del índice) y `npm run costos` no marca nada por hora. ✅ **Nada facturando.**

> Fix aplicado a `scripts/costos.js` durante esta verificación: antes marcaba como "cobra por hora" a instancias ya **terminadas** (siguen en el índice de etiquetas ~1 h). Ahora consulta el estado y las excluye, para que el "Listo cuando" del Bloque E no dé un falso positivo.

---

## Bugs reales encontrados y corregidos durante la verificación

1. **RDS no admite puntos en el identificador.** `CF_STUDENT=edgar.velasco` producía `crediflow-edgar.velasco-manual-db` → `InvalidParameterValue`. Corregido: los scripts sanean el punto (`crediflow-edgar-velasco-manual-*`) para RDS/S3/SG/IAM; el secreto conserva el formato con punto. Verificado: RDS llegó a `available`.
2. **El `api.zip` no incluía `tsconfig.base.json`.** `apps/api/tsconfig.json` hace `extends ../../tsconfig.base.json`, que no viajaba en el paquete → en la instancia `tsc` perdía `esModuleInterop` y `target ES2022` → el build fallaba → el servicio nunca arrancaba → `/health` mudo. Corregido: `paso_codigo` arma un artefacto auto-contenido (incluye la base + un `tsconfig.json` con `extends ./tsconfig.base.json`). Verificado: build OK en arranque limpio, `/health` verde sin intervención manual.

Correcciones de documento: `git switch -c sesion-2 a02-inicio` (es un tag, no rama), endpoint del reto con `s3.$CDK_DEFAULT_REGION` (la cuenta es us-east-2), y `limpiar` tolerante a variables vacías (caso "datos falló a la mitad").
