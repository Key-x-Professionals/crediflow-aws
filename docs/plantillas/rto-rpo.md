# RTO y RPO de CrediFlow · Equipo ______ · Sesión 4

**RTO** (Recovery Time Objective): tiempo máximo tolerable de interrupción.
**RPO** (Recovery Point Objective): pérdida máxima tolerable de datos, medida en tiempo.

## 1. Funciones de negocio y su criticidad

| Función | Impacto si falla 1 h | Criticidad (alta/media/baja) |
|---|---|---|
| Recepción de solicitudes (API) | | |
| Evaluación asíncrona | | |
| Precalificación | | |
| Notificaciones | | |

## 2. Objetivos propuestos

| Componente | RTO objetivo | RPO objetivo | Justificación |
|---|---|---|---|
| API en ECS Fargate (2 AZ) | | n/a (sin estado) | |
| DynamoDB solicitudes (sin PITR en dev) | | | |
| Cola SQS (mensajes en tránsito) | | | |
| DynamoDB precalificaciones | | | |

## 3. Qué tenemos hoy (medido en el laboratorio)

| Escenario | Tiempo de recuperación medido | ¿Pérdida de datos? |
|---|---|---|
| Muere una tarea ECS (parte E) | ____ s | no |
| Despliegue roto → rollback (parte G) | ____ s | no |
| Falla una AZ completa | (estimado) | |
| Se borra la tabla de solicitudes por error (sin PITR en dev) | (estimado: redeploy + datos perdidos) | todo |
| Borrado accidental de la tabla `solicitudes` | | |

## 4. Mejoras y su costo

| Mejora | RTO/RPO que mejora | Costo mensual aprox. | ¿La adoptaríamos? |
|---|---|---|---|
| PITR en DynamoDB (0.20 USD/GB-mes) | | | |
| Backups cada 5 min (PITR ya incluido) | | | |
| 3 tareas mínimo en 3 AZ | | | |
| Réplica de lectura en otra región | | | |

## 5. Decisión del equipo

RTO final: ____ · RPO final: ____ · Próximo paso:
