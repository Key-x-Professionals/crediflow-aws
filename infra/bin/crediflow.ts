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
  NetworkStack,
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
void cicd;

// ---- Sesión 4: API en contenedores -----------------------------------------
const service = new ServiceStack(app, 'Service', {
  config,
  session: 4,
  network: network.network,
  solicitudes: data.solicitudes,
  documentsBucket: data.documentsBucket,
  logsBucket: data.logsBucket,
});
void service;

app.synth();
