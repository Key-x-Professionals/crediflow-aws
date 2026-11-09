# Sesión 3 · Checklist de verificación (por equipo)

## CDK

- [ ] `npx cdk ls` muestra mis stacks con mi nombre de alumno
- [ ] `Network` y `Data` en `CREATE_COMPLETE`; el VPC no tiene NAT Gateway y la tabla DynamoDB es bajo demanda
- [ ] Puedo explicar qué hace `this.names.resource()` y por qué no escribimos nombres a mano
- [ ] Hice un `cdk diff` con un cambio destructivo y lo reconocí **sin** desplegar
- [ ] Entiendo la diferencia entre construct, stack y app
- [ ] Vi los Exports en CloudFormation y sé qué pasa si borro `Network` antes que `Data`

## Pruebas

- [ ] `npm test` pasa con al menos una prueba nueva escrita por el equipo

## Git y pipeline

- [ ] Cada integrante tiene su propio repositorio GitHub con el código
- [ ] `Cicd` desplegado; la trust policy del rol solo admite mi repositorio
- [ ] Secretos y variables configurados en GitHub (`AWS_DEPLOY_ROLE_ARN`, `CF_STUDENT`, ...)
- [ ] Un PR con CI verde, revisado por un compañero, mergeado
- [ ] El job `dev` desplegó con OIDC (sin llaves de acceso en ningún lado)
- [ ] El job `prod` pidió aprobación

## Limpieza

- [ ] Recursos manuales de la sesión 2 eliminados (`despliegue-manual limpiar`) y `npm run costos` sin recursos por hora
- [ ] No quedan recursos con `ManagedBy=manual`:
  `aws resourcegroupstaggingapi get-resources --tag-filters Key=ManagedBy,Values=manual`

**Validado por:** ____________
