# Despliegue manual de CrediFlow · Equipo ______ · Sesión 2

## 1. Inventario de recursos creados

| Recurso | Nombre / ID | Comando que lo creó | ¿Quién depende de él? |
|---|---|---|---|
| VPC | | `aws ec2 create-vpc ...` | subredes, SG |
| Subredes (4) | | | EC2, RDS |
| Internet Gateway | | | tabla de rutas |
| Tabla de rutas | | | subredes públicas |
| SG app | | | EC2 |
| SG db | | | RDS |
| Bucket S3 | | | EC2 (código) |
| Secreto | | | EC2 (credenciales) |
| DB subnet group | | | RDS |
| RDS | | | API |
| Rol + instance profile | | | EC2 |
| EC2 | | | — |

## 2. Métricas del proceso

- Comandos ejecutados: ____
- IDs que hubo que copiar/pegar: ____
- Tiempo total: ____ min (de los cuales esperando a RDS: ____ min)
- Errores cometidos y cómo se corrigieron:
  1.
  2.

## 3. Diagrama

<!-- Generado con Claude a partir de las notas (prompt 2.3). Pegar el Mermaid. -->

```mermaid
graph LR
```

## 4. Verificación

- [ ] `curl http://<ip>/health` → `storage: postgres`
- [ ] Datos persisten tras reiniciar el servicio
- [ ] Session Manager funciona sin puerto 22
- [ ] Frontend conectado

## 5. Costos

| Partida | Estimado sesión 1 | Real (Cost Explorer, 48 h después) |
|---|---|---|
| EC2 t3.micro | | |
| RDS db.t4g.micro + 20 GB | | |
| S3 | | |
| Otros (IP pública, snapshots) | | |

## 6. Qué dolió (para la sesión 3)

1.
2.
3.

## 7. ¿Qué pasaría si...?

- ...hay que reproducir esto en otra cuenta (prod)?
- ...alguien cambia una regla del SG desde la consola sin avisar?
- ...hay que agregar una segunda EC2 para alta disponibilidad?
