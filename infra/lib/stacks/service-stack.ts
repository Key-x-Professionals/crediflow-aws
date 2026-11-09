/**
 * ServiceStack (sesión 4): la API de solicitudes en ECS Fargate.
 *
 *  - Imagen construida desde apps/api/Dockerfile y publicada en ECR por CDK
 *  - 2 tareas mínimo en 2 AZ detrás de un ALB
 *  - Tareas en subredes públicas con IP pública (sin NAT Gateway: costo casi cero)
 *  - Datos en la tabla DynamoDB de solicitudes (sin secretos ni VPC para la base)
 *  - Autoscaling + circuit breaker con rollback
 *
 *  Costo: el ALB (~0.025 USD/h) y las tareas (~0.01 USD/h cada una) se cobran por hora:
 *  este stack se despliega al inicio de la sesión y se destruye al final.
 */
import * as path from 'path';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';
import { CrediFlowFargateService, CrediFlowTable, CrediFlowVpc, SecureBucket } from '../constructs';
import { CrediFlowStack, CrediFlowStackProps } from '../crediflow-stack';

export interface ServiceStackProps extends CrediFlowStackProps {
  readonly network: CrediFlowVpc;
  readonly solicitudes: CrediFlowTable;
  readonly documentsBucket: SecureBucket;
  readonly logsBucket: SecureBucket;
}

export class ServiceStack extends CrediFlowStack {
  public readonly api: CrediFlowFargateService;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    this.api = new CrediFlowFargateService(this, 'Api', {
      vpc: props.network.vpc,
      serviceName: this.names.resource('api'),
      logGroupName: this.names.logGroup('api'),
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, '..', '..', '..', 'apps', 'api'), {
        platform: ecrAssets.Platform.LINUX_ARM64,
      }),
      containerPort: 3000,
      healthCheckPath: '/health',
      minCapacity: 2,
      maxCapacity: this.cfg.isProd ? 10 : 4,
      taskSubnets: props.network.workloadSubnets,
      assignPublicIp: props.network.workloadsNeedPublicIp,
      removalPolicy: this.removalPolicy,
      accessLogsBucket: props.logsBucket.bucket,
      environment: {
        NODE_ENV: 'production',
        CF_STUDENT: this.cfg.student,
        CF_ENV: this.cfg.env,
        STORAGE: 'dynamo',
        TABLE_NAME: props.solicitudes.table.tableName,
        DOCUMENTS_BUCKET: props.documentsBucket.bucket.bucketName,
      },
    });

    // Mínimo privilegio: solo lo que la API necesita
    props.solicitudes.table.grantReadWriteData(this.api.taskDefinition.taskRole);
    props.documentsBucket.bucket.grantReadWrite(this.api.taskDefinition.taskRole);

    this.crossStackExport('ApiUrl', this.api.url, 'URL pública de la API de solicitudes');
    this.crossStackExport('AlbArn', this.api.loadBalancer.loadBalancerArn);
    this.publishParameter('ApiUrlParam', 'api-url', this.api.url);
  }
}
