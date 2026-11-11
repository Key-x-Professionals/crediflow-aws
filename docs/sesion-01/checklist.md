# Sesión 1 · Checklist de verificación (por equipo)

Marca cada punto solo cuando **todos** los integrantes lo hayan completado. El instructor valida al cierre.

## Acceso

- [ ] Entro a la consola con mi usuario (y MFA); `aws login --profile crediflow` funciona y `aws sts get-caller-identity` muestra `user/<mi usuario>`
- [ ] La misma identidad aparece en la consola (arriba a la derecha), en la CLI y en el SDK
- [ ] `.env` completo y `npm run verify` sin ❌

## Infraestructura global

- [ ] Sé cuántas AZ tiene mi región y qué es un `ZoneId`
- [ ] Puedo explicar con un ejemplo de CrediFlow la diferencia región / AZ / edge location

## IAM y mínimo privilegio

- [ ] Creé el bucket `crediflow-<alumno>-lab1-<cuenta>` con un objeto
- [ ] Creé el rol `crediflow-<alumno>-lab1-lector` con política inline de solo lectura
- [ ] Asumí el rol y `aws s3 ls` funcionó
- [ ] `aws s3 cp` devolvió `AccessDenied` y puedo nombrar: identidad, acción, recurso y causa
- [ ] Volví a mi identidad de usuario
- [ ] Entiendo por qué la trust policy del rol solo acepta a mi usuario

## Costos

- [ ] Sé dónde ver el crédito restante de la cuenta (Billing → Free Tier) y mi rol aparece filtrando por la etiqueta `Student`
- [ ] Tengo anotada la estimación de la calculadora para la sesión 2

## Formas de interactuar

- [ ] `node scripts/sdk/quien-soy.js` respondió con mi identidad
- [ ] CrediFlow corre localmente: creé una solicitud desde la web y desde la CLI

## Responsabilidad compartida y Well-Architected

- [ ] En equipo clasificamos 6 tareas de CrediFlow como "de AWS" o "del cliente"
- [ ] Nombramos los 6 pilares y dimos un ejemplo de cada uno para CrediFlow

**Firma del equipo:** ______________________ **Validado por:** ____________
