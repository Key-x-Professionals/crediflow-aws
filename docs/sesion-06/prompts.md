# Sesión 6 · Biblioteca de prompts (Claude)

## 6.1 Entender y corregir hallazgos de cdk-nag

```
Estos son hallazgos de cdk-nag (AwsSolutions) sobre un proyecto CDK de un curso (entorno dev, costo
controlado, datos ficticios). Para cada uno: explica el riesgo en una frase, di si lo CORREGIRÍAS
(con el cambio de código en CDK) o lo RECONOCERÍAS con una justificación (escribe el `reason` tal
como lo aceptaría un auditor). Marca los que nunca deberían suprimirse en producción.

<pega la salida de npm run nag>
```

## 6.2 Consultas de Logs Insights en lenguaje natural

```
Mis logs son JSON con campos: method, path, status, durationMs, requestId (API) y
message, solicitudId, resultado, score, level (worker, Powertools).
Escribe consultas de CloudWatch Logs Insights para:
1. Las 10 rutas más lentas por p95 en la última hora
2. Tasa de errores (status >= 500) por minuto
3. Solicitudes rechazadas con score entre 550 y 600
4. requestIds que tardaron más de 2 s y su path
Explica cada consulta en una línea.
```

## 6.3 Asistente de diagnóstico en el simulacro

```
Soy el ingeniero de guardia de CrediFlow (API en ECS Fargate + ALB, DynamoDB, SQS + Lambda
worker, API Gateway + Lambda, EventBridge). Acaba de dispararse la alarma: <nombre y razón>.
Síntomas: <lo que ves>. Salidas de comandos: <pega>.
Actúa como compañero de diagnóstico: dame la hipótesis más probable, el siguiente comando de la
AWS CLI para confirmarla, y qué NO debo tocar todavía. Un paso a la vez; espera mi respuesta.
```

## 6.4 Borrador del postmortem

```
Redacta un postmortem sin culpas (blameless) con esta estructura: resumen, impacto, línea de tiempo,
causa raíz, qué funcionó, qué no funcionó, acciones (con responsable y fecha), lecciones.
Usa solo estos hechos y no inventes ninguno; donde falte información pon [POR CONFIRMAR].

Hechos:
<línea de tiempo con horas, comandos, decisiones>
```

## 6.5 Revisar un runbook

```
Revisa este runbook de operación. Señala pasos ambiguos, comandos que podrían empeorar el incidente,
información que falta (dueño, severidad, cómo escalar, cómo verificar la recuperación) y reescríbelo
para que lo pueda seguir alguien que nunca ha visto el sistema, a las 3 a.m.

<pega runbook-<equipo>.md>
```

## 6.6 Preparar la demo final

```
Tengo 4 minutos para demostrar CrediFlow (flujo de solicitud, precalificación con login, dashboard
y alarma) y 4 integrantes. Propón un guion minuto a minuto con quién habla, qué pantalla muestra y
una frase de transición entre partes. Incluye 3 preguntas difíciles que podría hacer el instructor
sobre el código y una respuesta corta para cada una.
```
