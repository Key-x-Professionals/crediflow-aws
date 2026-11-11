# Sesión 5 · Checklist de verificación (por equipo)

Marca cada punto solo cuando **todos** los integrantes lo hayan completado.

- [ ] Leí `motor.ts`, `precalificar.ts` y `evaluador.ts`, y puedo explicar qué hace cada uno
- [ ] `Serverless` completo: sin token 401, con token 200, y un ítem en la tabla con mi `sub`
- [ ] Puedo explicar qué comprueba API Gateway en el token y por qué el token no debe llevar secretos
- [ ] Cada función tiene el permiso mínimo: `precalificar` solo escribe, `consultar` solo lee, el notificador no toca tablas
- [ ] `Events` completo y la API conectada a la cola (`queue: configured`)
- [ ] Una solicitud pasó sola de `EN_EVALUACION` a `APROBADA` y llegó el correo
- [ ] Vi las dos reglas actuar sobre un mismo evento (rechazo de 20,000 o más)
- [ ] La web muestra las cuatro tarjetas en verde y la precalificación funciona con inicio de sesión
- [ ] Idempotencia: tres mensajes de la misma solicitud, una sola evaluación; vi la marca con `expiresAt`
- [ ] Cola de errores: el mensaje envenenado llegó tras tres intentos y la alarma avisó
- [ ] Podemos explicar cuándo conviene un flujo asíncrono y qué exige "al menos una vez"
- [ ] Pull request fusionado con el CI en verde
- [ ] **`npm run apagar` terminado y `npm run costos` sin recursos por hora**

La guía completa está en [guia-laboratorio.md](guia-laboratorio.md).
