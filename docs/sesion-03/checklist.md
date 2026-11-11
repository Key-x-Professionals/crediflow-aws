# Sesión 3 · Checklist de verificación (por equipo)

Marca cada punto solo cuando **todos** los integrantes lo hayan completado.

- [ ] `cdk ls` muestra mis stacks con mi nombre de alumno
- [ ] `Network` desplegado: VPC en dos zonas, sin NAT Gateway, con las cinco etiquetas
- [ ] Leímos el diff de cambiar el CIDR y podemos explicar qué significa `requires replacement`
- [ ] `Data` desplegado: tabla `tbl-solicitudes` bajo demanda con dos índices y dos buckets cifrados y sin acceso público
- [ ] `npm test` pasa, con al menos una prueba escrita por mí
- [ ] Tengo mi repositorio en GitHub y `CF_GITHUB_REPO` apunta a él
- [ ] El rol `role-github-deploy` solo confía en mi repositorio (lo leí en *Trust relationships*)
- [ ] En GitHub hay un ARN y variables de configuración, y **ninguna** llave de acceso
- [ ] Pull request revisado por un compañero, CI en verde, fusionado
- [ ] El job de dev desplegó con OIDC; no lanzamos prod
- [ ] `npm run apagar` ejecutado y `npm run costos` sin recursos por hora
- [ ] Podemos explicar por qué CrediFlow pasó de RDS a DynamoDB y qué se cede con el cambio

La guía completa está en [guia-laboratorio.md](guia-laboratorio.md).
