#!/usr/bin/env node
/**
 * Punto de entrada de la aplicación CDK de CrediFlow.
 *
 * Cada stack corresponde a una sesión del curso. Para desplegar uno solo:
 *   npx cdk deploy CrediFlow-<student>-dev-Network
 * Para desplegar todos:
 *   npx cdk deploy --all
 */
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag';
import { loadConfig } from '../lib/config';
import {
  CicdStack,
  DataStack,
  EventsStack,
  NetworkStack,
  ObservabilityStack,
  SecurityStack,
  ServerlessStack,
  ServiceStack,
} from '../lib/stacks';

const app = new cdk.App();
const config = loadConfig();

// El proveedor OIDC de GitHub es UNO por cuenta. En la cuenta del curso ya existe (lo creó el
// instructor), así que por defecto se reutiliza. Solo si la cuenta es tuya y no lo tiene:
// CF_CREATE_OIDC_PROVIDER=true hace que el construct lo cree.
const oidcProviderArn =
  process.env.CF_CREATE_OIDC_PROVIDER === 'true'
    ? undefined
    : `arn:aws:iam::${config.account}:oidc-provider/token.actions.githubusercontent.com`;

// ---- Sesión 3: red, datos y pipeline ---------------------------------------
const network = new NetworkStack(app, 'Network', { config, session: 3 });

const data = new DataStack(app, 'Data', { config, session: 3 });

const cicd = config.githubRepo
  ? new CicdStack(app, 'Cicd', {
      config,
      session: 3,
      existingProviderArn: oidcProviderArn,
    })
  : undefined;

// ---- Sesión 5: colas y eventos (antes del servicio, porque la API usa la cola)
const events = new EventsStack(app, 'Events', {
  config,
  session: 5,
  solicitudes: data.solicitudes,
});

// ---- Sesión 4: API en contenedores -----------------------------------------
const service = new ServiceStack(app, 'Service', {
  config,
  session: 4,
  network: network.network,
  solicitudes: data.solicitudes,
  documentsBucket: data.documentsBucket,
  logsBucket: data.logsBucket,
  queue: events.queue.queue,
});

// ---- Sesión 5: API serverless de precalificación ---------------------------
const serverless = new ServerlessStack(app, 'Serverless', { config, session: 5 });

// ---- Sesión 6: seguridad y observabilidad ----------------------------------
new SecurityStack(app, 'Security', {
  config,
  session: 6,
  loadBalancer: service.api.loadBalancer,
  restApi: serverless.api.api,
  logsBucket: data.logsBucket,
  accountLevelSecurity: (process.env.CF_ACCOUNT_SECURITY ?? 'false') === 'true',
});

new ObservabilityStack(app, 'Observability', {
  config,
  session: 6,
  api: service.api,
  precalApi: serverless.api,
  precalificarFn: serverless.precalificarFn,
  workerFn: events.workerFn,
  queue: events.queue,
});

// ---- cdk-nag: revisión automática de buenas prácticas (sesión 6) -----------
if (config.nagEnabled) {
  cdk.Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }));
  aplicarReconocimientos();
}

/**
 * Reconocimientos (suppressions) JUSTIFICADOS. Cada uno es una decisión
 * consciente del curso, no una forma de "callar" la herramienta.
 */
function aplicarReconocimientos(): void {
  NagSuppressions.addStackSuppressions(network, [
    { id: 'AwsSolutions-VPC7', reason: 'Flow logs configurados solo para tráfico rechazado (suficiente para el curso).' },
  ]);
  NagSuppressions.addStackSuppressions(serverless, [
    { id: 'AwsSolutions-DDB3', reason: 'PITR solo en prod por costo; datos ficticios del curso.' },
  ], true);
  NagSuppressions.addStackSuppressions(data, [
    { id: 'AwsSolutions-DDB3', reason: 'Point-in-time recovery solo en prod: en dev tiene costo por GB y los datos son ficticios.' },
  ]);
  if (cicd) {
    NagSuppressions.addStackSuppressions(cicd, [
      { id: 'AwsSolutions-IAM5', reason: 'cdk deploy necesita asumir los roles cdk-* del bootstrap; es el patrón recomendado por AWS.' },
    ], true);
  }
  NagSuppressions.addStackSuppressions(service, [
    { id: 'AwsSolutions-ECS4', reason: 'Container Insights cobra por métrica; el dashboard de la sesión 6 usa las métricas estándar del servicio.' },
    { id: 'AwsSolutions-ECS2', reason: 'Las variables de entorno no contienen secretos: el acceso a DynamoDB es por rol IAM.' },
    { id: 'AwsSolutions-EC23', reason: 'El ALB y las tareas son públicos por diseño (sin NAT para costo cero); el SG solo admite tráfico del ALB y WAF protege el perímetro.' },
    { id: 'CdkNagValidationFailure', reason: 'El CIDR del VPC es una referencia entre stacks que la regla no puede resolver.' },
    { id: 'AwsSolutions-IAM5', reason: 'Comodines generados por los grants de CDK (bucket de documentos, ECR y logs).' },
  ], true);
  NagSuppressions.addStackSuppressions(serverless, [
    { id: 'AwsSolutions-COG2', reason: 'MFA opcional: usuarios de prueba del curso.' },
    { id: 'AwsSolutions-COG3', reason: 'La protección avanzada requiere el plan Plus (costo).' },
    { id: 'AwsSolutions-COG8', reason: 'Plan Essentials elegido por costo; Plus queda documentado como mejora.' },
    { id: 'AwsSolutions-COG4', reason: 'La ruta /health es pública a propósito para chequeos de salud.' },
    { id: 'AwsSolutions-APIG4', reason: 'La ruta /health es pública a propósito para chequeos de salud.' },
    { id: 'AwsSolutions-APIG2', reason: 'La validación de entrada se hace en la Lambda con zod.' },
    { id: 'AwsSolutions-APIG3', reason: 'El WebACL se asocia desde SecurityStack (referencia entre stacks).' },
    { id: 'AwsSolutions-IAM4', reason: 'AWSLambdaBasicExecutionRole es el rol estándar de ejecución.' },
    { id: 'AwsSolutions-IAM5', reason: 'Comodines generados por grants de CDK (tabla y logs).' },
  ], true);
  NagSuppressions.addStackSuppressions(events, [
    { id: 'AwsSolutions-IAM4', reason: 'AWSLambdaBasicExecutionRole es el rol estándar de ejecución.' },
    { id: 'AwsSolutions-DDB3', reason: 'La tabla de idempotencia es efímera (TTL 24 h): no necesita PITR.' },
    { id: 'AwsSolutions-IAM5', reason: 'Comodines generados por grants de CDK.' },
    { id: 'AwsSolutions-SQS3', reason: 'La DLQ no necesita otra DLQ.' },
  ], true);
}

app.synth();
