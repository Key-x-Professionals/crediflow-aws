# Guía de observabilidad de CrediFlow (tarea previa a la sesión 6 · 30 min de lectura)

## 1. Las tres fuentes: métricas, logs y trazas

| Fuente | Qué responde | Dónde está en CrediFlow |
|---|---|---|
| **Métricas** (números en el tiempo) | ¿Está sano? ¿Cuánto tráfico? | CloudWatch Metrics: `AWS/ApplicationELB`, `AWS/ECS`, `AWS/Lambda`, `AWS/SQS`, `AWS/ApiGateway` y el namespace propio `CrediFlow` |
| **Logs** (eventos con contexto) | ¿Qué pasó exactamente? | CloudWatch Logs: `/crediflow/<alumno>/dev/api`, `/fn-evaluador`, `/fn-precalificar`, `/precal-api`, `aws-waf-logs-*` |
| **Trazas** (una petición a través de servicios) | ¿Dónde se fue el tiempo? | X-Ray: API Gateway → Lambda → DynamoDB; worker → DynamoDB / EventBridge |

## 2. Señales doradas (Google SRE) aplicadas a CrediFlow

| Señal | Métrica concreta | Alarma del `ObservabilityStack` |
|---|---|---|
| Latencia | `TargetResponseTime` p95 del ALB; `Latency` p95 de API Gateway | `alarm-api-latencia` (> 1 s, 3 min) |
| Tráfico | `RequestCount` del ALB; `Count` de API Gateway | (sin alarma: se observa) |
| Errores | `HTTPCode_ELB_5XX` + `HTTPCode_Target_5XX`; `Errors` de Lambda; mensajes en DLQ | `alarm-api-5xx`, `alarm-lambda-errores`, `alarm-dlq` |
| Saturación | `CPUUtilization`/`MemoryUtilization` de ECS; `ApproximateAgeOfOldestMessage` de SQS; `HealthyHostCount` | `alarm-cola-antiguedad`, `alarm-api-hosts` |

Una buena alarma es **accionable**: cuando suena, alguien sabe qué hacer (por eso cada alarma referencia un runbook en su descripción).

## 3. Logs estructurados

La API escribe una línea JSON por petición:

```json
{"level":"info","requestId":"...","method":"POST","path":"/solicitudes","status":201,"durationMs":42}
```

Las Lambdas usan **Powertools for AWS Lambda (TypeScript)**:

- `Logger`: JSON con `service`, `cold_start`, `function_request_id` y las claves que agregues (`logger.appendKeys({ solicitudId })`).
- `Metrics`: métricas de negocio en formato EMF (`SolicitudesEvaluadas`, `SolicitudesAprobadas`, `SolicitudesRechazadas`, `MensajesDuplicados`, `ErroresEvaluacion`) sin llamadas extra a la API.
- `Tracer`: segmentos de X-Ray para cada llamada del SDK.

Lee `apps/worker/src/evaluador.ts` y ubica los tres.

## 4. Consultas de Logs Insights que debes conocer

```
# Errores de la API
fields @timestamp, path, status, requestId | filter status >= 500 | sort @timestamp desc | limit 50

# Latencia p95 por ruta
stats pct(durationMs, 95) as p95, count(*) as n by path | sort p95 desc

# Evaluaciones por resultado (worker)
filter message = "Solicitud evaluada" | stats count(*) by resultado

# Cold starts de una Lambda
filter cold_start = 1 | stats count(*) by bin(5m)
```

## 5. Dashboard

El `ObservabilityStack` crea un dashboard con 4 filas: tráfico/errores/latencia · saturación/cola/errores Lambda · métricas de negocio · estado de alarmas. Reglas al diseñarlo: una pregunta por gráfico, mismas unidades por eje, las alarmas visibles arriba.

## 6. Antes de la sesión 6

- [ ] `CF_ALERT_EMAIL` en tu `.env` y suscripción de SNS confirmada (llegó en la sesión 5)
- [ ] Leíste `infra/lib/stacks/observability-stack.ts` (esqueleto) y sabes qué métrica alimenta cada alarma
- [ ] Probaste `aws logs tail` y una consulta de Logs Insights sobre tus logs
- [ ] Puedes decir, para CrediFlow, qué es un síntoma (lo que ve el usuario) y qué es una causa (lo que ve el runbook)
