# Sesión 3 · Reto para casa (opcional, 30-40 min, sin costo y sin desplegar)

**Objetivo.** Agregar dos pruebas de infraestructura y demostrar que tu pipeline bloquea un cambio que las rompe.

**Cómo.** En `infra/test/data-stack.test.ts` escribe dos pruebas: (1) todos los buckets tienen cifrado por defecto; (2) la tabla tiene exactamente dos índices. Una pista para cada una:

```ts
it('todos los buckets están cifrados', () => {
  template.allResourcesProperties('AWS::S3::Bucket', {
    BucketEncryption: Match.objectLike({ ServerSideEncryptionConfiguration: Match.anyValue() }),
  });
});

it('la tabla tiene exactamente dos índices', () => {
  const tablas = template.findResources('AWS::DynamoDB::GlobalTable');
  const indices = Object.values(tablas)[0].Properties.GlobalSecondaryIndexes;
  expect(indices).toHaveLength(2);
});
```

(`Match` se importa de `aws-cdk-lib/assertions`.) Comprueba con `npm test` que pasan. Después, en una rama nueva, **rompe una a propósito**: comenta el índice `porEstado` en `data-stack.ts`, haz commit, push y abre un pull request.

**Cómo comprobar.** El workflow CI del pull request debe quedar en rojo, y en el registro del paso *Pruebas* debe aparecer el nombre de tu prueba. Restaura el índice, haz commit y push: el mismo pull request debe pasar a verde. Fusiona solo entonces. (Como apagaste, el job de despliegue fallará al no encontrar el rol: es lo esperado; la próxima sesión, tras `npm run encender`, puedes relanzarlo.)

**Qué entregas.** En el canal del curso: el enlace a tu pull request, donde se vean la ejecución en rojo y la ejecución en verde, y el código de tus dos pruebas. Si usaste IA, cuenta qué le pediste y qué tuviste que corregir.

**Bonus.** Agrega `expect(template.toJSON()).toMatchSnapshot()` y haz un cambio pequeño para ver cómo falla. ¿Cuándo ayuda una prueba así y cuándo estorba?
