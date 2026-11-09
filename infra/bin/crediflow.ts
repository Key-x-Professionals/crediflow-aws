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
import { AwsSolutionsChecks } from 'cdk-nag';
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

// ---- Sesión 3: red, datos y pipeline ---------------------------------------
const network = new NetworkStack(app, 'Network', { config, session: 3 });

const data = new DataStack(app, 'Data', { config, session: 3 });

if (config.githubRepo) {
  new CicdStack(app, 'Cicd', {
    config,
    session: 3,
    existingProviderArn: process.env.CF_GITHUB_OIDC_PROVIDER_ARN,
  });
}

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
  // TODO (sesión 6, parte A): corregir hallazgos y agregar NagSuppressions JUSTIFICADAS
}

app.synth();
