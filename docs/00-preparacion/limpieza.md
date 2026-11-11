# Limpieza de recursos (al terminar el curso o una sesión de pruebas)

Todo lo que creaste tiene costo mientras exista. Orden recomendado:

## 0. Al final de CADA sesión

```bash
npm run apagar      # cdk destroy --all --force
npm run costos      # nada "por hora" debe quedar encendido
```

## 1. Recursos de CDK (sesiones 3 a 6), al terminar el curso

```bash
cd infra
npx cdk destroy --all          # confirma con "y"
```

Si un stack no se destruye por dependencias, destruye en orden inverso: `Observability`, `Security`, `Serverless`, `Service`, `Events`, `Data`, `Network`, `Cicd`.

Los buckets y tablas con `RemovalPolicy.RETAIN` (solo en `CF_ENV=prod`) se borran a mano:

```bash
aws s3 rb s3://<bucket> --force
aws dynamodb delete-table --table-name <tabla>
```

## 2. Despliegue manual (sesión 2)

```bash
./scripts/manual/despliegue-manual.sh limpiar        # Mac
.\scripts\manual\despliegue-manual.ps1 limpiar        # Windows
```

## 3. Laboratorio 1

```bash
aws s3 rb s3://crediflow-$CF_STUDENT-lab1-$CDK_DEFAULT_ACCOUNT --force
aws iam delete-role-policy --role-name crediflow-$CF_STUDENT-lab1-lector --policy-name lectura-s3
aws iam delete-role --role-name crediflow-$CF_STUDENT-lab1-lector
```

## 4. Verificar que no quede nada

```bash
aws resourcegroupstaggingapi get-resources --tag-filters Key=Student,Values=$CF_STUDENT \
  --query 'ResourceTagMappingList[].ResourceARN' --output table
```

Y revisa Cost Explorer filtrando por la etiqueta `Student` al día siguiente.

## 5. Al terminar el curso

```bash
gh workflow disable deploy.yml          # tu repositorio sigue siendo tuyo; el despliegue ya no tiene a dónde ir
aws logout --profile crediflow
```

## 6. Solo el instructor: lo que es de la cuenta

- Comprobar que no queda nada de nadie: `aws resourcegroupstaggingapi get-resources --tag-filters Key=Project,Values=CrediFlow --query 'ResourceTagMappingList[].ResourceARN'`.
- Desactivar GuardDuty: `aws guardduty delete-detector --detector-id <id>`.
- Vaciar el repositorio de imágenes y el bucket de archivos de despliegue de CDK (`cdk-hnb659fds-container-assets-…` y `cdk-hnb659fds-assets-…`); si no habrá más cursos, borrar el stack `CDKToolkit`.
- Borrar los ajustes de cuenta del curso: el proveedor OIDC de GitHub, el rol `crediflow-apigateway-logs` y el grupo `crediflow-alumnos`.
- Desactivar o borrar los usuarios de los alumnos.
- Al día siguiente, revisar Cost Explorer por la etiqueta `Student`.

