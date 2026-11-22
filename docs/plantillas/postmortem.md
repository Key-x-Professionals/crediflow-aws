# Postmortem · CrediFlow · Incidente ______ · Fecha ______

> **Sin culpas (blameless).** El objetivo es entender el sistema y mejorarlo, no señalar personas. Se escribe en las 24 h siguientes.

## Resumen (3 líneas)

Qué pasó, cuánto duró, a quién afectó.

## Impacto

| | |
|---|---|
| Severidad | S1 / S2 / S3 |
| Duración (detección → resolución) | ____ min |
| Solicitudes afectadas | ____ (de ____ en el periodo) |
| Usuarios / sistemas afectados | |
| ¿Pérdida de datos? | |

## Línea de tiempo (hora local, UTC-6)

| Hora | Evento | Fuente (alarma, persona, log) |
|---|---|---|
| | Se inyecta la falla / inicia el problema | |
| | Alarma `____` pasa a ALARM | CloudWatch |
| | El equipo nota ____ | |
| | Hipótesis 1: ____ · comando: ____ · resultado: ____ | |
| | Causa confirmada | |
| | Mitigación aplicada: ____ | |
| | Servicio recuperado (alarma OK) | |
| | Corrección definitiva (`cdk deploy` / PR #__) | |

## Causa raíz

Describe la cadena causal (no solo el "gatillo"). Técnica de los 5 porqués:

1. ¿Por qué falló? →
2. ¿Por qué...? →
3. ...

## Detección

- ¿Qué lo detectó primero: alarma, dashboard, una persona? Tiempo hasta detección: ____ min.
- ¿Qué alarma/señal faltó o llegó tarde?

## Qué funcionó bien

-

## Qué no funcionó / dónde tuvimos suerte

-

## Acciones correctivas

| Acción | Tipo (prevenir / detectar / mitigar) | Responsable | Fecha | Estado |
|---|---|---|---|---|
| | | | | |
| | | | | |

## Lecciones

-
