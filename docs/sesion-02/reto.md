# Sesión 2 · Reto opcional: endurecer el servidor artesanal

*No afecta el avance del proyecto. 45-60 min.*

Elige uno o varios:

## R1. Bucket con política que exige HTTPS y el rol de la EC2

Agrega una *bucket policy* que (a) niegue cualquier request sin `aws:SecureTransport`, y (b) niegue `s3:PutObject` a cualquier principal que no sea el rol de la EC2. Verifica con `aws s3 cp` desde tu usuario (debe fallar) y desde Session Manager en la EC2 (debe funcionar).

## R2. EC2 en subred privada

Mueve la API a `private-a`: crea un **NAT Gateway** en `public-a` (para que el user data pueda instalar paquetes), una tabla de rutas privada, y expón la API con un **Application Load Balancer** en las subredes públicas. Documenta el costo adicional del NAT (y por qué en la sesión 3 CDK lo crea por ti).

## R3. Cifrado de la base de datos con tu propia llave (KMS)

Crea una llave KMS administrada por el cliente, restaura el snapshot de RDS con esa llave y actualiza el secreto. ¿Qué cambia en la responsabilidad compartida?

## R4. Backups automáticos y restauración

Activa `--backup-retention-period 7`, crea una solicitud, borra la tabla `solicitudes` con `psql` desde la EC2 (`dnf install postgresql16`), y restaura **a un punto en el tiempo** anterior. Mide tu RTO real.

## Entrega

Comandos usados + captura de la verificación en el canal del curso.
