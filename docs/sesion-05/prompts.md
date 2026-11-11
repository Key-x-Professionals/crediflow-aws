# Sesión 5 · Biblioteca de prompts (Claude)

## 5.1 Casos de prueba del motor de precalificación

```
Este es el motor de precalificación de CrediFlow (ficticio). Genera una tabla de 10 casos de prueba
con entradas y salida esperada que cubran: límites del DTI (39.9 %, 40 %, 40.1 %), ingreso mínimo,
plazos en cada tramo de tasa, y montos extremos. Luego escribe los casos como pruebas Jest adicionales
para motor.test.ts.

<pega apps/precalificacion/src/motor.ts>
```

## 5.2 Diseño de claves en DynamoDB

```
Guardo precalificaciones en DynamoDB con pk = "USER#<sub>" y sk = "PRECAL#<fecha ISO>#<id>".
Patrones de acceso: (1) últimas N precalificaciones de un usuario, (2) una precalificación por id,
(3) todas las precalificaciones no elegibles de la última semana (para un reporte).
Evalúa si el diseño actual cubre cada patrón, qué índice secundario haría falta para el (3),
y qué pasaría con el costo si usara Scan. Explica "single table design" en 5 líneas.
```

## 5.3 Abogado del diablo: modos de falla del flujo asíncrono

```
Flujo: API en ECS publica en SQS → Lambda worker (batch 5, 3 reintentos, DLQ) actualiza DynamoDB
y publica en EventBridge → regla → SNS y otra Lambda.
Actúa como abogado del diablo: lista 8 formas en que este flujo puede fallar o producir resultados
incorrectos (duplicados, orden, pérdida, parcialidad, timeouts, límites de concurrencia, etc.),
el síntoma que vería el usuario, y la mitigación. Ordena por probabilidad x impacto.
```

## 5.4 Revisar la idempotencia

```
Revisa la idempotencia de este worker de SQS. Responde: ¿qué pasa si falla después del UPDATE
pero antes de PutEvents? ¿Y si dos invocaciones concurrentes reciben el mismo solicitudId?
¿Es correcto liberar la marca de idempotencia en el catch? Propón mejoras concretas con código.

<pega apps/worker/src/evaluador.ts>
```

## 5.5 Leer una traza de X-Ray

```
Esta es una traza de X-Ray de una Lambda detrás de API Gateway que escribe en DynamoDB (segmentos y
duraciones abajo). ¿Dónde se va el tiempo? ¿Hay cold start? ¿Qué optimizarías primero?

<pega los segmentos>
```

## 5.6 Claude Code (opcional)

```
Agrega al worker (apps/worker/src/evaluador.ts) una métrica Powertools "MontoAprobado" (suma del monto
de solicitudes aprobadas) y una prueba unitaria del motor para montos límite. Corre npm test -w apps/worker.
No cambies la lógica de idempotencia.
```
