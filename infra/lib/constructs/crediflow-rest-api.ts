/**
 * CrediFlowRestApi: API Gateway REST con buenas prácticas.
 *
 *  - Logs de acceso en CloudWatch y métricas detalladas
 *  - Throttling por defecto (protección básica contra abuso)
 *  - CORS abierto para que el frontend Next.js pueda llamarla
 *  - Autorizador Cognito opcional: `addRoute(path, method, fn, { auth: true })`
 *  - X-Ray activo
 */
import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface CrediFlowRestApiProps {
  readonly apiName: string;
  readonly logGroupName: string;
  readonly stageName?: string;
  readonly userPool?: cognito.IUserPool;
  readonly removalPolicy?: cdk.RemovalPolicy;
  readonly throttlingRateLimit?: number;
  readonly throttlingBurstLimit?: number;
}

export interface AddRouteOptions {
  /** Exige un JWT válido de Cognito (Authorization: Bearer <idToken>) */
  readonly auth?: boolean;
}

export class CrediFlowRestApi extends Construct {
  public readonly api: apigw.RestApi;
  public readonly authorizer?: apigw.CognitoUserPoolsAuthorizer;
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: CrediFlowRestApiProps) {
    super(scope, id);

    this.logGroup = new logs.LogGroup(this, 'AccessLogs', {
      logGroupName: props.logGroupName,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.DESTROY,
    });

    this.api = new apigw.RestApi(this, 'Api', {
      restApiName: props.apiName,
      description: `CrediFlow API serverless (${props.apiName})`,
      deployOptions: {
        stageName: props.stageName ?? 'v1',
        tracingEnabled: true,
        metricsEnabled: true,
        loggingLevel: apigw.MethodLoggingLevel.INFO,
        accessLogDestination: new apigw.LogGroupLogDestination(this.logGroup),
        accessLogFormat: apigw.AccessLogFormat.jsonWithStandardFields(),
        throttlingRateLimit: props.throttlingRateLimit ?? 50,
        throttlingBurstLimit: props.throttlingBurstLimit ?? 100,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key'],
      },
      cloudWatchRole: false,
    });

    if (props.userPool) {
      this.authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
        cognitoUserPools: [props.userPool],
        authorizerName: `${props.apiName}-cognito`,
        resultsCacheTtl: cdk.Duration.minutes(5),
      });
    }
  }

  /**
   * Agrega una ruta respaldada por una Lambda.
   * Ej: api.addRoute('precalificar', 'POST', fn, { auth: true })
   */
  addRoute(path: string, method: string, fn: lambda.IFunction, options: AddRouteOptions = {}): apigw.Method {
    const resource = path
      .split('/')
      .filter(Boolean)
      .reduce<apigw.IResource>((parent, part) => parent.getResource(part) ?? parent.addResource(part), this.api.root);

    if (options.auth && !this.authorizer) {
      throw new Error('La API no tiene userPool configurado: no se puede exigir autenticación');
    }

    return resource.addMethod(method, new apigw.LambdaIntegration(fn), {
      authorizer: options.auth ? this.authorizer : undefined,
      authorizationType: options.auth ? apigw.AuthorizationType.COGNITO : apigw.AuthorizationType.NONE,
    });
  }

  get url(): string {
    return this.api.url;
  }
}
