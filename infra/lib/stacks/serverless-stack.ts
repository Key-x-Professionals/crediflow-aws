/**
 * ServerlessStack (sesión 5): API de precalificación sin servidores.
 *
 *  - Cognito User Pool (usuarios de prueba creados por CLI)
 *  - API Gateway REST con autorizador Cognito
 *  - Lambda `precalificar` que calcula elegibilidad y guarda en DynamoDB
 *  - Lambda `consultar` que lee precalificaciones del usuario
 *
 * El stack viene casi completo para que lo LEAS. Te toca escribir lo que decide la seguridad
 * (busca los TODO del bloque A): los permisos mínimos de cada función y la ruta protegida que falta.
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
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly api: CrediFlowRestApi;
  public readonly table: CrediFlowTable;
  public readonly precalificarFn: CrediFlowFunction;

  constructor(scope: Construct, id: string, props: CrediFlowStackProps) {
    super(scope, id, props);

    // ---- Identidad -------------------------------------------------------
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: this.names.resource('users'),
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      passwordPolicy: { minLength: 10, requireDigits: true, requireUppercase: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: this.removalPolicy,
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
    });

    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: this.names.resource('web'),
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
      idTokenValidity: cdk.Duration.hours(1),
      accessTokenValidity: cdk.Duration.hours(1),
    });

    // ---- Datos -----------------------------------------------------------
    this.table = new CrediFlowTable(this, 'Precalificaciones', {
      tableName: this.names.table('precalificaciones'),
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING }, // USER#<sub>
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },      // PRECAL#<timestamp>
      removalPolicy: this.removalPolicy,
    });

    // ---- Funciones -------------------------------------------------------
    this.precalificarFn = new CrediFlowFunction(this, 'PrecalificarFn', {
      functionName: this.names.lambda('precalificar'),
      logGroupName: this.names.logGroup('fn-precalificar'),
      entry: path.join(HANDLERS, 'precalificar.ts'),
      serviceName: 'precalificacion',
      environment: { TABLE_NAME: this.table.table.tableName },
      removalPolicy: this.removalPolicy,
    });
    // TODO (bloque A): permiso mínimo → precalificar solo ESCRIBE en la tabla (grantWriteData)

    const consultarFn = new CrediFlowFunction(this, 'ConsultarFn', {
      functionName: this.names.lambda('consultar-precal'),
      logGroupName: this.names.logGroup('fn-consultar-precal'),
      entry: path.join(HANDLERS, 'consultar.ts'),
      serviceName: 'precalificacion',
      environment: { TABLE_NAME: this.table.table.tableName },
      removalPolicy: this.removalPolicy,
    });
    // TODO (bloque A): permiso mínimo → consultar solo LEE de la tabla (grantReadData)

    const healthFn = new CrediFlowFunction(this, 'HealthFn', {
      functionName: this.names.lambda('precal-health'),
      logGroupName: this.names.logGroup('fn-precal-health'),
      entry: path.join(HANDLERS, 'health.ts'),
      serviceName: 'precalificacion',
      removalPolicy: this.removalPolicy,
    });

    // ---- API -------------------------------------------------------------
    this.api = new CrediFlowRestApi(this, 'Api', {
      apiName: this.names.resource('precal-api'),
      logGroupName: this.names.logGroup('precal-api'),
      userPool: this.userPool,
      removalPolicy: this.removalPolicy,
    });
    this.api.addRoute('health', 'GET', healthFn.fn);
    this.api.addRoute('precalificaciones', 'GET', consultarFn.fn, { auth: true });
    // TODO (bloque A): falta la ruta principal, protegida igual que la anterior con el autorizador de Cognito:
    //   POST /precalificar → this.precalificarFn.fn, con { auth: true }

    // ---- Salidas ---------------------------------------------------------
    this.crossStackExport('PrecalApiUrl', this.api.url, 'URL de la API de precalificación');
    this.crossStackExport('UserPoolId', this.userPool.userPoolId);
    this.crossStackExport('UserPoolClientId', this.userPoolClient.userPoolClientId);
    this.publishParameter('PrecalUrlParam', 'precal-url', this.api.url);
    this.publishParameter('UserPoolParam', 'user-pool-id', this.userPool.userPoolId);
    this.publishParameter('ClientParam', 'user-pool-client-id', this.userPoolClient.userPoolClientId);
  }
}
