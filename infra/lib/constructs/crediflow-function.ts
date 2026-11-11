/**
 * CrediFlowFunction: Lambda en TypeScript con valores por defecto sensatos.
 *
 *  - Empaquetado con esbuild (NodejsFunction) directamente desde apps/
 *  - Runtime Node.js 24 en arquitectura ARM64 (más barato)
 *  - X-Ray activo, log group con retención de 1 semana
 *  - Variables de entorno de Powertools (service name, log level)
 *  - Timeout y memoria razonables
 */
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface CrediFlowFunctionProps {
  readonly functionName: string;
  readonly logGroupName: string;
  /** Ruta absoluta al archivo .ts del handler */
  readonly entry: string;
  readonly handler?: string;
  readonly serviceName: string;
  readonly environment?: Record<string, string>;
  readonly memorySize?: number;
  readonly timeout?: cdk.Duration;
  readonly removalPolicy?: cdk.RemovalPolicy;
  readonly vpc?: cdk.aws_ec2.IVpc;
  readonly vpcSubnets?: cdk.aws_ec2.SubnetSelection;
  readonly reservedConcurrentExecutions?: number;
}

export class CrediFlowFunction extends Construct {
  public readonly fn: lambdaNode.NodejsFunction;
  public readonly logGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: CrediFlowFunctionProps) {
    super(scope, id);

    this.logGroup = new logs.LogGroup(this, 'Logs', {
      logGroupName: props.logGroupName,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.DESTROY,
    });

    this.fn = new lambdaNode.NodejsFunction(this, 'Fn', {
      functionName: props.functionName,
      entry: props.entry,
      handler: props.handler ?? 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: props.memorySize ?? 256,
      timeout: props.timeout ?? cdk.Duration.seconds(10),
      tracing: lambda.Tracing.ACTIVE,
      logGroup: this.logGroup,
      vpc: props.vpc,
      vpcSubnets: props.vpcSubnets,
      reservedConcurrentExecutions: props.reservedConcurrentExecutions,
      environment: {
        POWERTOOLS_SERVICE_NAME: props.serviceName,
        POWERTOOLS_LOG_LEVEL: 'INFO',
        POWERTOOLS_METRICS_NAMESPACE: 'CrediFlow',
        NODE_OPTIONS: '--enable-source-maps',
        ...props.environment,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node24',
        format: lambdaNode.OutputFormat.CJS,
        externalModules: ['@aws-sdk/*'],
      },
    });
  }
}
