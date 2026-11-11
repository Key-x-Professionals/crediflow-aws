# Sesión 6 · Checklist de verificación (por equipo)

Marca cada punto solo cuando **todos** los integrantes lo hayan completado.

- [ ] `npm run nag` sin errores: un hallazgo corregido y otro reconocido con una razón que explica qué, por qué y qué lo compensa
- [ ] `Security` completo: 403 por contenido en las dos puertas y 403 por tasa
- [ ] Vi en los registros del WAF qué regla bloqueó cada petición
- [ ] Encontré en CloudTrail la entrada del pipeline por OIDC y mis propios `stop-task`
- [ ] `Observability` completo: tablero con datos y siete alarmas en `OK`
- [ ] Puedo explicar por qué `alarm-api-hosts` trata la falta de datos como alarma
- [ ] Tres consultas de Logs Insights guardadas, incluida la que sigue una solicitud por su identificador
- [ ] Simulacro: detectamos en ____ min y mitigamos en ____ min; sabemos qué se cambió, quién y cuándo
- [ ] Sabemos qué vio y qué no vio la detección de deriva, y por qué `cdk diff` no la muestra
- [ ] Runbook del equipo completado, con un paso nuevo aprendido en el simulacro
- [ ] Postmortem sin culpables con resumen, impacto, línea de tiempo, causa raíz y acciones
- [ ] Demo final presentada; cada integrante explicó una parte
- [ ] Pull request final fusionado con el CI en verde
- [ ] **`npm run apagar` terminado y cero recursos con mi etiqueta `Student`**

La guía completa está en [guia-laboratorio.md](guia-laboratorio.md).
