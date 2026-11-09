/**
 * CrediFlowVpc: red lista para usar, pensada para costo casi cero.
 *
 *  - 2 zonas de disponibilidad (alta disponibilidad desde el día 1)
 *  - Subredes públicas (ALB y tareas con IP pública) y aisladas (sin salida a internet)
 *  - SIN NAT Gateway por defecto (~32 USD/mes cada uno): las tareas de Fargate
 *    salen a internet con IP pública (0.005 USD/h) protegidas por su security group.
 *    Con `natGateways: 1` se agregan subredes privadas con salida (modo "producción").
 *  - Endpoints gateway de S3 y DynamoDB (gratis)
 *  - VPC Flow Logs solo de tráfico rechazado (volumen mínimo)
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface CrediFlowVpcProps {
  /** Nombre del VPC (etiqueta Name) */
  readonly vpcName: string;
  /** CIDR, por defecto 10.0.0.0/16 */
  readonly cidr?: string;
  /** Número de NAT Gateways (0 = sin costo fijo; 1 ó 2 = subredes privadas con salida) */
  readonly natGateways?: number;
  /** Endpoints de interfaz (SSM, ECR, Logs): ~7 USD/mes cada uno. Por defecto false. */
  readonly interfaceEndpoints?: boolean;
  /** Flow logs a CloudWatch (por defecto true, solo REJECT) */
  readonly flowLogs?: boolean;
  readonly removalPolicy?: cdk.RemovalPolicy;
}

export class CrediFlowVpc extends Construct {
  public readonly vpc: ec2.Vpc;
  public readonly natGateways: number;

  constructor(scope: Construct, id: string, props: CrediFlowVpcProps) {
    super(scope, id);

    this.natGateways = props.natGateways ?? 0;

    const subnetConfiguration: ec2.SubnetConfiguration[] = [
      { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
    ];
    if (this.natGateways > 0) {
      subnetConfiguration.splice(1, 0, { name: 'private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 });
    }

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: props.vpcName,
      ipAddresses: ec2.IpAddresses.cidr(props.cidr ?? '10.0.0.0/16'),
      maxAzs: 2,
      natGateways: this.natGateways,
      subnetConfiguration,
    });

    if (props.flowLogs ?? true) {
      const flowLogGroup = new logs.LogGroup(this, 'FlowLogs', {
        logGroupName: `/aws/vpc/${props.vpcName}/flow-logs`,
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.DESTROY,
      });
      this.vpc.addFlowLog('FlowLog', {
        destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup),
        trafficType: ec2.FlowLogTrafficType.REJECT,
      });
    }

    // Endpoints gateway: gratis y evitan salir a internet para S3 y DynamoDB
    this.vpc.addGatewayEndpoint('S3Endpoint', { service: ec2.GatewayVpcEndpointAwsService.S3 });
    this.vpc.addGatewayEndpoint('DynamoEndpoint', { service: ec2.GatewayVpcEndpointAwsService.DYNAMODB });

    if (props.interfaceEndpoints) {
      this.vpc.addInterfaceEndpoint('SsmEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.SSM });
      this.vpc.addInterfaceEndpoint('SsmMessagesEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES });
      this.vpc.addInterfaceEndpoint('Ec2MessagesEndpoint', { service: ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES });
    }
  }

  /** Subredes públicas (ALB) */
  get publicSubnets(): ec2.SubnetSelection {
    return { subnetType: ec2.SubnetType.PUBLIC };
  }

  /**
   * Subredes para cargas de trabajo (ECS, Lambda en VPC).
   * Sin NAT no hay subredes privadas con salida: se usan las públicas con IP pública.
   */
  get workloadSubnets(): ec2.SubnetSelection {
    return this.natGateways > 0 ? { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS } : { subnetType: ec2.SubnetType.PUBLIC };
  }

  /** true cuando las cargas de trabajo necesitan IP pública para salir a internet */
  get workloadsNeedPublicIp(): boolean {
    return this.natGateways === 0;
  }

  /** Subredes aisladas (bases de datos) */
  get isolatedSubnets(): ec2.SubnetSelection {
    return { subnetType: ec2.SubnetType.PRIVATE_ISOLATED };
  }
}
