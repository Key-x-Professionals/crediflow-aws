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
