# Sesión 4 · Checklist de verificación (por equipo)

Marca cada punto solo cuando **todos** los integrantes lo hayan completado.

- [ ] Construí la imagen localmente, respondió `/health` y puedo explicar las dos etapas del Dockerfile y por qué corre como `node`
- [ ] `ServiceStack` desplegado por el pipeline (o desde mi máquina, con el motivo anotado)
- [ ] Dos tareas en dos zonas distintas; balanceador con dos destinos *healthy*
- [ ] Sé por qué las tareas tienen IP pública (sin NAT Gateway, decisión de costo) y qué las protege (su security group solo acepta al balanceador)
- [ ] La API escribe en DynamoDB con el rol de la tarea, sin contraseñas; vi los ítems en la consola
- [ ] Frontend conectado con `web-env`, mostrando `env: dev`
- [ ] Autorreparación: detuve una tarea, `/health` no falló y anoté el tiempo de recuperación: ____ s
- [ ] Carga: p50 ____ ms, p95 ____ ms; el servicio escaló a ____ tareas
- [ ] Rollback: el despliegue con `FAIL_HEALTH` se deshizo solo y la API no dejó de responder; tiempo: ____ min
- [ ] Documento `rto-rpo-<equipo>.md` con objetivos justificados, dos valores medidos y el costo de mejorarlos
- [ ] Podemos explicar por qué una aplicación **sin estado** es requisito para escalar en horizontal
- [ ] **`npm run apagar` terminado y `npm run costos` sin recursos por hora**

La guía completa está en [guia-laboratorio.md](guia-laboratorio.md).
