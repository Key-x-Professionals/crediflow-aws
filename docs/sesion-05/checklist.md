# Sesión 5 · Checklist de verificación (por equipo)

## Serverless

- [ ] `Serverless` desplegado; `/health` público, `/precalificar` y `/precalificaciones` con Cognito
- [ ] Sin token → 401; con token → 200; vi los claims del JWT
- [ ] Ítem en DynamoDB con `pk = USER#<sub>` y puedo explicar por qué ese diseño de claves
- [ ] Traza en X-Ray de `fn-precalificar` con el segmento de DynamoDB
- [ ] Puedo explicar cold start, memoria vs costo y por qué ARM64

## Eventos

- [ ] `Events` desplegado; suscripción SNS confirmada
- [ ] `ServiceStack` recibe la cola; `/health` → `queue: configured`
- [ ] Una solicitud recorrió el flujo completo y llegó el correo
- [ ] La regla de rechazo ≥ 20,000 disparó el notificador (log con otra regla)
- [ ] Idempotencia: mensaje duplicado ignorado, ítem con TTL
- [ ] DLQ: mensaje envenenado llegó a la DLQ, alarma en ALARM, correo recibido
- [ ] Sé qué hace `reportBatchItemFailures` y por qué el visibility timeout es 6× el timeout

## Frontend

- [ ] 4 tarjetas verdes en **Estado**
- [ ] Solicitud creada desde la web cambia sola de `EN EVALUACION` a `APROBADA/RECHAZADA`
- [ ] Login y precalificación desde la web

## Pipeline

- [ ] PR mergeado; el deploy reporta `No changes` (código = realidad)

**Validado por:** ____________
