# Sesión 2 · Biblioteca de prompts (Claude)

## 2.1 Entender un comando largo de la CLI

```
Explícame qué hace este comando de la AWS CLI parámetro por parámetro, qué recurso crea,
qué dependencias necesita haber creado antes, y qué pasaría si omito cada parámetro opcional.
No ejecutes nada; solo explica.

<pega el comando>
```

## 2.2 Diagnóstico de conectividad (antes de tocar nada)

```
Tengo una EC2 en una subred pública y una RDS PostgreSQL en una subred privada del mismo VPC.
/health de mi API responde "degraded" (no conecta a la base de datos).
Dame una lista ordenada de hipótesis de la más a la menos probable, y para cada una el comando
exacto de la AWS CLI para confirmarla o descartarla (describe-security-groups, describe-route-tables,
describe-db-instances, etc.). No cambies nada hasta confirmar la causa.

Datos:
- SG de la EC2: <id>   SG de la RDS: <id>
- Subred EC2: <cidr>   Subred RDS: <cidr>
- Endpoint RDS: <host>
```

## 2.3 Diagrama a partir de las notas del despliegue

```
A partir de estas notas de un despliegue manual en AWS, genera un diagrama en sintaxis Mermaid
(graph LR) que muestre VPC, subredes por AZ, IGW, tabla de rutas, security groups, EC2, RDS,
S3 y Secrets Manager, con las flechas de tráfico (80 → EC2, 5432 → RDS) y de permisos (rol → S3, rol → secreto).
Luego escribe tres frases sobre qué partes serían difíciles de reproducir a mano en otra cuenta.

<pega despliegue-manual-<equipo>.md>
```

## 2.4 Leer un user data

```
Este es el user data de una EC2 Amazon Linux 2023. Explica cada bloque, identifica riesgos de
seguridad u operación (por ejemplo: dónde quedan las credenciales, qué pasa si falla npm install,
qué pasa al reiniciar la instancia) y propone mejoras concretas sin cambiar el objetivo.

<pega scripts/manual/user-data.sh>
```

## 2.5 Comparar con el costo estimado

```
En la sesión 1 estimamos <monto> USD/mes para EC2 t3.micro + RDS db.t4g.micro + S3.
Hoy creamos además: <lista>. Recalcula el estimado, señala qué partidas son por hora aunque
no se usen (y por eso hay que apagarlas) y cuáles son por uso.
```
