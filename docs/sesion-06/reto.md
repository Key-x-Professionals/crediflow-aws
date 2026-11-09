# Sesión 6 · Retos opcionales (para después del curso)

## R1. Respaldo y restauración de DynamoDB

Activa point-in-time recovery en la tabla `solicitudes` (`pointInTimeRecovery: true`, cuesta ~0.20 USD/GB/mes), crea 5 solicitudes, borra 2 con `aws dynamodb delete-item` y restaura la tabla a un momento anterior con `aws dynamodb restore-table-to-point-in-time`. Mide tu RTO real y documenta cómo apuntarías la API a la tabla restaurada (pista: `TABLE_NAME` y `cdk deploy Service`).

## R2. Alarma compuesta y SLO

Crea una `CompositeAlarm` "CrediFlow degradado" = (5xx OR latencia OR hosts) y define un SLO: 99.5 % de `/solicitudes` en < 500 ms al mes. Calcula el *error budget* y agrega un widget al dashboard.

## R3. Security Hub

Activa Security Hub con el estándar *AWS Foundational Security Best Practices* y compara sus hallazgos con los de cdk-nag: ¿cuáles son los mismos, cuáles solo ve uno?

## R4. Chaos engineering con AWS FIS

Crea un experimento de **AWS Fault Injection Service** que detenga el 50 % de las tareas ECS y mide el impacto con el dashboard. Hazlo primero en dev; documenta un *stop condition* basado en la alarma de hosts.

## R5. Despliegue del frontend

Ver [retos/frontend-amplify-ec2.md](../retos/frontend-amplify-ec2.md).
