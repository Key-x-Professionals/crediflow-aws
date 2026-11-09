# Sesión 3 · Reto opcional: mejores prácticas de IaC

*No afecta el avance del proyecto. Elige uno.*

## R1. TTL y limpieza automática en DynamoDB

En `CrediFlowTable` agrega soporte para `timeToLiveAttribute` y úsalo en la tabla `solicitudes` con un atributo `expiraEn` (epoch en segundos) que la API escriba a 30 días. Despliega, crea una solicitud con `expiraEn` en el pasado y observa cuánto tarda DynamoDB en borrarla (puede ser hasta 48 h: documenta por qué el TTL no sirve como mecanismo de negocio exacto). Escribe la prueba de `Template` que verifique `TimeToLiveSpecification`.

## R2. Un construct nuevo con prueba

Crea `infra/lib/constructs/crediflow-parameter.ts`: un construct que publique un objeto JSON como varios parámetros SSM (`/crediflow/<alumno>/<env>/<clave>`). Escribe una prueba con `Template.fromStack` que verifique el número de parámetros. Úsalo en `DataStack`.

## R3. Snapshot tests

Agrega `expect(template.toJSON()).toMatchSnapshot()` a las pruebas y haz un cambio a propósito para ver cómo falla. Discute en equipo cuándo conviene y cuándo estorba.

## R4. Comparar con Terraform

Pide a Claude el equivalente en Terraform del `NetworkStack` (prompt 3.5). Anota 3 diferencias concretas (estado, lenguaje, construcciones de alto nivel) y una situación en la que elegirías cada uno.

## R5. Proteger `main`

En GitHub: *Settings → Branches → Add rule*: require PR, require status checks (`Build, pruebas y cdk synth`), require 1 approval, no force push. Intenta hacer `git push origin main` directo y observa el rechazo.
