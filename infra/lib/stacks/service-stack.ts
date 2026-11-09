/**
 * ServiceStack (sesión 4): la API de solicitudes en ECS Fargate.
 *
 * TODO (laboratorio, parte B):
 *   1. Crear CrediFlowFargateService con la imagen de apps/api (fromAsset, LINUX_ARM64),
 *      puerto 3000, health check /health, 2 tareas mínimo, logs de acceso del ALB en logsBucket
 *   2. Red: taskSubnets = props.network.workloadSubnets, assignPublicIp = props.network.workloadsNeedPublicIp
 *      (sin NAT Gateway las tareas viven en subredes públicas con IP pública: costo casi cero)
 *   3. environment: NODE_ENV, CF_STUDENT, CF_ENV, STORAGE='dynamo', TABLE_NAME, DOCUMENTS_BUCKET
 *      (sin secretos: el acceso a DynamoDB es por el rol IAM de la tarea)
 *   4. Permisos mínimos: solicitudes.table.grantReadWriteData(taskRole), documentsBucket.bucket.grantReadWrite(taskRole)
 *   5. Exports ApiUrl y AlbArn; parámetro SSM api-url
 *
 *  Costo: el ALB (~0.025 USD/h) y las tareas (~0.01 USD/h) se cobran por hora:
 *  este stack se despliega al inicio de la sesión y se destruye al final (npm run apagar).
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
  public readonly api!: CrediFlowFargateService;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    const apiPath = path.join(__dirname, '..', '..', '..', 'apps', 'api');
    void apiPath; void ecs; void ecrAssets; // elimina estas líneas al completar el TODO

    // TODO: this.api = new CrediFlowFargateService(this, 'Api', { ... });
    // TODO: permisos mínimos
    // TODO: exports y parámetro SSM
  }
}
