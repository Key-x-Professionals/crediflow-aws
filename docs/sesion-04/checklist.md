# Sesión 4 · Checklist de verificación (por equipo)

## Contenedores

- [ ] Construí la imagen localmente y respondió `/health`
- [ ] Puedo explicar las dos etapas del Dockerfile y por qué corre como `node`, no `root`

## ServiceStack

- [ ] Desplegado por el pipeline (o local con justificación)
- [ ] 2 tareas en 2 AZ distintas; sé por qué tienen IP pública (sin NAT Gateway, decisión de costo) y qué las protege (security group)
- [ ] ALB público con 2 targets `healthy`
- [ ] La API escribe en DynamoDB con el rol de la tarea (sin contraseñas); vi los ítems en Explore items
- [ ] Frontend conectado con `web-env` y muestra `env: dev`

## Pruebas

- [ ] Autorreparación: detuve una tarea, `/health` nunca falló, anoté el tiempo de recuperación: ____ s
- [ ] Carga: p50 ____ ms, p95 ____ ms; el servicio escaló a ____ tareas
- [ ] Rollback: despliegue con `FAIL_HEALTH` revertido automáticamente; la API no dejó de responder

## Disponibilidad

- [ ] Documento RTO/RPO con valores justificados y el costo de mejorarlos
- [ ] Puedo explicar por qué una app **sin estado** es requisito para escalar horizontalmente
- [ ] Sé qué pasa si una AZ completa falla (y lo puedo demostrar con la consola de ECS)

## Costos

- [ ] `npm run apagar` ejecutado al cierre; `npm run costos` sin recursos por hora

**Validado por:** ____________
