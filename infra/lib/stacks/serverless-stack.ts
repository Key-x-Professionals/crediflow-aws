/**
 * ServerlessStack (sesión 5): API de precalificación sin servidores.
 *
 * TODO (laboratorio, parte A2):
 *   1. userPool (sin auto-registro, login por email, política de contraseñas) + userPoolClient (USER_PASSWORD_AUTH, sin secreto)
 *   2. table: CrediFlowTable 'precalificaciones' con pk/sk (string)
 *   3. precalificarFn, consultarFn, healthFn con CrediFlowFunction (entry en apps/precalificacion/src/*.ts, TABLE_NAME)
 *      - grantWriteData a precalificar, grantReadData a consultar
 *   4. api: CrediFlowRestApi con userPool; rutas: GET health (pública), POST precalificar y GET precalificaciones (auth)
 *   5. Exports PrecalApiUrl, UserPoolId, UserPoolClientId; parámetros SSM precal-url, user-pool-id, user-pool-client-id
 */
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { CrediFlowFunction, CrediFlowRestApi, CrediFlowTable } from '../constructs';
import { CrediFlowStack, CrediFlowStackProps } from '../crediflow-stack';

const HANDLERS = path.join(__dirname, '..', '..', '..', 'apps', 'precalificacion', 'src');

export class ServerlessStack extends CrediFlowStack {
  public readonly userPool!: cognito.UserPool;
  public readonly userPoolClient!: cognito.UserPoolClient;
  public readonly api!: CrediFlowRestApi;
  public readonly table!: CrediFlowTable;
  public readonly precalificarFn!: CrediFlowFunction;

  constructor(scope: Construct, id: string, props: CrediFlowStackProps) {
    super(scope, id, props);
    void HANDLERS; void cdk; void dynamodb; // elimina al completar el TODO

    // TODO: identidad (Cognito)
    // TODO: datos (DynamoDB)
    // TODO: funciones (Lambda)
    // TODO: API (API Gateway + rutas)
    // TODO: salidas
  }
}
