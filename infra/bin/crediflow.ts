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
import { loadConfig } from '../lib/config';
import {
  CicdStack,
  DataStack,
  EventsStack,
  NetworkStack,
  ServerlessStack,
  ServiceStack,
} from '../lib/stacks';

const app = new cdk.App();
const config = loadConfig();

// ---- Sesión 3: red, datos y pipeline ---------------------------------------
const network = new NetworkStack(app, 'Network', { config, session: 3 });

const data = new DataStack(app, 'Data', { config, session: 3 });

const cicd = config.githubRepo
  ? new CicdStack(app, 'Cicd', {
      config,
      session: 3,
      existingProviderArn: process.env.CF_GITHUB_OIDC_PROVIDER_ARN,
    })
  : undefined;
void cicd;

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
  // TODO (sesión 5, parte B1): queue: events.queue.queue,
});

// ---- Sesión 5: API serverless de precalificación ---------------------------
const serverless = new ServerlessStack(app, 'Serverless', { config, session: 5 });
void service; void serverless; void events;

app.synth();
