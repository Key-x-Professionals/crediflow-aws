# Sesión 2 · Checklist de verificación (por equipo)

## Red

- [ ] VPC `crediflow-<alumno>-manual-vpc` con 4 subredes en 2 AZ
- [ ] Solo las subredes públicas tienen ruta a 0.0.0.0/0 (lo comprobé en la tabla de rutas)
- [ ] Puedo explicar la diferencia entre security group (stateful, por recurso) y network ACL (stateless, por subred)

## Seguridad

- [ ] `sg-db` solo acepta 5432 desde `sg-app` (no desde una IP)
- [ ] La EC2 no tiene puerto 22 abierto y entré con Session Manager
- [ ] El rol de la EC2 solo puede leer MI secreto y MI bucket

## Datos

- [ ] RDS PostgreSQL cifrada, no pública, en subredes privadas
- [ ] La contraseña vive solo en Secrets Manager; nunca la vi ni la escribí
- [ ] Bucket privado, cifrado; el código de la API llegó por S3

## Aplicación

- [ ] `curl http://<ip>/health` → `storage: postgres`, `database: ok`
- [ ] Creé solicitudes, reinicié el servicio y los datos persistieron
- [ ] Frontend conectado con `NEXT_PUBLIC_API_URL`
- [ ] Hice al menos 2 operaciones básicas (snapshot, versionado, métricas o diagnóstico)

## Documento `despliegue-manual-<equipo>.md`

- [ ] Lista de recursos con IDs y nombres
- [ ] Número total de comandos y tiempo invertido
- [ ] Diagrama generado con Claude a partir de las notas
- [ ] Tres "dolores" del proceso manual que CDK debería resolver

## Costos

- [ ] Todo lo creado hoy fue destruido con `despliegue-manual limpiar` (RDS y EC2 cobran por hora)
- [ ] `get-resources --tag-filters Key=ManagedBy,Values=manual` devuelve vacío

**Validado por:** ____________
