# Sesión 6 · Checklist de verificación (por equipo)

## Seguridad

- [ ] `npm run nag` sin `ERROR`; cada supresión tiene un `reason` defendible
- [ ] WAF asociado al ALB y a API Gateway; 403 por contenido malicioso y por rate limit
- [ ] Encontré en CloudTrail mi `stop-task` de la sesión 4 y un `AssumeRoleWithWebIdentity` del pipeline
- [ ] Vi un hallazgo de GuardDuty (de muestra) y sé qué haría con él
- [ ] Puedo explicar defensa en profundidad con 4 capas de CrediFlow (identidad, red, perímetro, datos)

## Observabilidad

- [ ] Dashboard con tráfico, errores, latencia, saturación, cola y métricas de negocio
- [ ] 6 alarmas en `OK`, suscripción de correo confirmada
- [ ] 3 consultas de Logs Insights (errores, p95 por ruta, evaluaciones por resultado)
- [ ] Service map de X-Ray con los dos flujos
- [ ] Sé qué son las 4 señales doradas y qué alarma cubre cada una en CrediFlow

## Operación

- [ ] Simulacro: detectado en ____ min, mitigado en ____ min, causa: ____________
- [ ] `cdk diff` mostró la deriva y `cdk deploy` la eliminó
- [ ] `runbook-<equipo>.md` con comandos reales
- [ ] `postmortem-<equipo>.md` sin culpas, con acciones y responsables

## Demo final

- [ ] Flujo completo desde el frontend hasta el correo
- [ ] Precalificación con login
- [ ] Dashboard y alarma en vivo
- [ ] Cada integrante respondió una pregunta sobre el código

**Validado por:** ____________
