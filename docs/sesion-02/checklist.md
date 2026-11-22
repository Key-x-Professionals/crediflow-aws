# Sesión 2 · Checklist de verificación (por equipo)

Marca cada punto solo cuando **todos** los integrantes lo hayan completado.

- [ ] VPC `crediflow-<usuario>-manual-vpc` con cuatro subredes en dos zonas; solo las públicas tienen ruta a `0.0.0.0/0`
- [ ] Podemos explicar qué hace pública a una subred y la diferencia entre security group y network ACL
- [ ] `sg-db` solo acepta el puerto 5432 desde `sg-app`; ningún grupo abre el 22
- [ ] RDS PostgreSQL cifrada, no pública, en subredes privadas
- [ ] La contraseña vive solo en Secrets Manager; nadie la vio ni la escribió
- [ ] El rol de la EC2 solo puede leer **su** secreto y **su** bucket
- [ ] `/health` respondió `ok` con `storage: postgres`; entramos al servidor con Session Manager
- [ ] Creamos solicitudes, reiniciamos el servicio y los datos persistieron; la web quedó conectada
- [ ] Hicimos una operación básica (diagnóstico, snapshot o métricas)
- [ ] Documento `despliegue-manual-<equipo>.md` con recursos, número de comandos, tiempo y tres dolores
- [ ] **Todo destruido:** la búsqueda por `ManagedBy=manual` devuelve vacío y `npm run costos` no marca nada por hora
- [ ] Bucket y rol del laboratorio 1 eliminados

La guía completa está en [guia-laboratorio.md](guia-laboratorio.md).
