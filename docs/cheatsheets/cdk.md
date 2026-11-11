# Hoja rápida · AWS CDK

## Ciclo de trabajo

```
código TS ──synth──► CloudFormation (cdk.out) ──diff──► comparar con AWS ──deploy──► CloudFormation ──► recursos
```

| Comando (desde `infra/`) | Qué hace |
|---|---|
| `npx cdk ls` | Lista los stacks de la app |
| `npx cdk synth <Stack> --quiet` | Genera la plantilla en `cdk.out/` |
| `npx cdk diff <Stack>` | Qué cambiaría respecto a lo desplegado |
| `npx cdk deploy <Stack>` | Despliega (pide confirmación si hay cambios IAM/SG) |
| `npx cdk deploy --all --require-approval never` | Todo, sin preguntar (pipeline) |
| `npx cdk destroy <Stack>` | Destruye |
| `npx cdk bootstrap aws://<cuenta>/<región>` | Una vez por cuenta/región |
| `npx cdk watch <Stack>` | Redespliega al guardar (hotswap, solo dev) |
| `CF_NAG=true npx cdk synth` / `npm run nag` | Revisión con cdk-nag |
| `npx cdk context --clear` | Borra lookups cacheados (AZ, AMI) |

Nombres de stack en este proyecto: `CrediFlow-<alumno>-<env>-<Nombre>`; con `npx cdk ls` ves los IDs cortos (`Network`, `Data`, ...) que acepta la CLI.

## Conceptos

- **App** → **Stack** (unidad de despliegue = stack de CloudFormation) → **Construct** (componente reutilizable).
- Constructs **L1** (`CfnBucket`: 1:1 con CloudFormation), **L2** (`Bucket`: valores por defecto sensatos y métodos como `grantRead`), **L3/patrones** (`ApplicationLoadBalancedFargateService`: varios recursos juntos). Los de `infra/lib/constructs/` son L3 propios del curso.
- **Grants**: `bucket.grantReadWrite(role)`, `table.grantWriteData(fn)`, `queue.grantSendMessages(taskRole)` generan políticas IAM de mínimo privilegio.
- **Referencias entre stacks**: pasar un objeto (`network: network.network`, `solicitudes: data.solicitudes`) crea un Export/Import automático. El stack que exporta no se puede borrar mientras otro importe.
- **RemovalPolicy**: `DESTROY` (dev) vs `RETAIN`/`SNAPSHOT` (prod). En el curso lo decide `this.removalPolicy`.
- **Tokens**: `bucket.bucketName` es un placeholder (`${Token[...]}`) hasta el deploy. No se puede hacer `if (bucket.bucketName === ...)`.
- **Context lookups** (`Vpc.fromLookup`, AZs): se cachean en `cdk.context.json`; se versiona.

## Patrones del proyecto

```ts
export class MiStack extends CrediFlowStack {
  constructor(scope: Construct, id: string, props: CrediFlowStackProps) {
    super(scope, id, props);
    const bucket = new SecureBucket(this, 'Docs', { bucketName: this.names.bucket('docs'), removalPolicy: this.removalPolicy });
    this.crossStackExport('DocsBucket', bucket.bucket.bucketName);
    this.publishParameter('DocsParam', 'docs-bucket', bucket.bucket.bucketName);
  }
}
```

Pruebas (`aws-cdk-lib/assertions`):

```ts
const template = Template.fromStack(stack);
template.resourceCountIs('AWS::S3::Bucket', 2);
template.hasResourceProperties('AWS::DynamoDB::GlobalTable', { BillingMode: 'PAY_PER_REQUEST' });
template.hasResourceProperties('AWS::EC2::VPC', { Tags: Match.arrayWith([{ Key: 'Student', Value: 'test' }]) });
```

## Errores frecuentes

| Mensaje | Causa / solución |
|---|---|
| `Need to perform AWS calls for account ...` | Sin sesión: `aws login --profile crediflow` |
| `Resolution error: ... Token` | Usaste un token en un `if`/string template; usa `cdk.Fn` o pásalo como prop |
| `Export ... cannot be deleted as it is in use` | Otro stack importa el valor; despliega primero el consumidor sin la referencia |
| `DependencyCycle` | Dos stacks se referencian mutuamente; mueve el recurso al stack que lo consume o expórtalo por SSM (`publishParameter`) en vez de una referencia directa |
| `is not authorized to perform: iam:PassRole` | Tu permission set no permite pasar ese rol; revisa con el instructor |
| `Docker daemon not running` | Abrir Docker Desktop (assets de contenedor) |
| `This CDK CLI is not compatible with the CDK library` | `npm install` para alinear versiones |
