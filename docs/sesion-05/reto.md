# Sesión 5 · Reto opcional

*No afecta el avance del proyecto.*

## R1. Idempotencia en la API (no solo en el worker)

Agrega soporte al header `X-Idempotency-Key` en `POST /solicitudes`: si llega la misma clave dos veces, devuelve la misma solicitud sin crear otra. Guarda la clave en DynamoDB (reutiliza la tabla de idempotencia del worker o agrega un atributo con índice único por condición). Prueba con `curl` dos veces.

## R2. Validación de entrada en API Gateway

Define un *request model* (JSON Schema) para `/precalificar` y un `RequestValidator` en `CrediFlowRestApi`, para que las peticiones inválidas se rechacen **antes** de invocar la Lambda (y no cuesten). Compara en los logs de acceso.

## R3. Archivo de eventos y replay

Activa un **Archive** en el bus de eventos (`bus.archive(...)`) y haz un **replay** de los eventos de la última hora. ¿Para qué serviría en CrediFlow? ¿Qué pasa con el notificador si los eventos se repiten?

## R4. Step Functions para una evaluación en pasos

Reemplaza la Lambda `evaluador` por una máquina de estados: verificar identidad (simulada) → calcular score → si score < 650, revisión manual (espera con `waitForTaskToken`) → notificar. Dibuja el flujo con Claude antes de escribirlo.

## R5. Powertools Idempotency

Sustituye la idempotencia manual del worker por `@aws-lambda-powertools/idempotency` con `DynamoDBPersistenceLayer`. ¿Qué casos cubre que el código manual no?
