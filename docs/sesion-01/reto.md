# Sesión 1 · Reto opcional: política aún más restrictiva

*No afecta el avance del proyecto. 30-45 min. Entrega: captura de la CLI + política en el canal del curso.*

## Objetivo

Reescribir la política del rol lector para que:

1. Solo pueda leer objetos cuyo **prefijo** sea `publico/` dentro del bucket.
2. Solo funcione si la llamada viene por **HTTPS** (`aws:SecureTransport`).
3. Solo sea válida **durante las próximas 2 horas** (`aws:CurrentTime`).

## Pistas

- Separa `s3:ListBucket` (recurso = bucket, condición `s3:prefix`) de `s3:GetObject` (recurso = `bucket/publico/*`).
- Usa Claude con el prompt 1.2 para proponer la política y **luego** verifícala con el [IAM Policy Simulator](https://policysim.aws.amazon.com/).
- Actualiza con `aws iam put-role-policy` (mismo nombre `lectura-s3` para reemplazar).
- Prueba subiendo un objeto a `publico/` y otro a `privado/` con tu usuario, y leyéndolos con el rol.

## Bonus

Activa **MFA** en tu usuario de Identity Center y agrega a la trust policy la condición `aws:MultiFactorAuthPresent: true`. ¿Qué pasa al asumir el rol?

## Qué aprendes

Variables y condiciones de IAM, la diferencia entre permisos sobre el bucket y sobre los objetos, y a validar políticas antes de aplicarlas.
