/**
 * CrediFlowFargateService: API en contenedores con todo lo necesario para producción.
 *
 *  - Clúster ECS + servicio Fargate en 2 AZ
 *  - Por defecto las tareas van en subredes públicas con IP pública (sin NAT Gateway:
 *    costo casi cero); con `taskSubnets`/`assignPublicIp` se cambia a subredes privadas
 *  - Application Load Balancer público con health check en /health
 *  - Autoscaling por CPU y por solicitudes por target
 *  - Circuit breaker con rollback automático si el despliegue falla
 *  - Logs en CloudWatch con retención corta
 *  - Imagen construida desde el Dockerfile del repo (CDK la sube a ECR)
 *  - Secretos inyectados desde Secrets Manager (nunca en texto plano)
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface CrediFlowFargateServiceProps {
  readonly vpc: ec2.IVpc;
  readonly serviceName: string;
  readonly logGroupName: string;
  /** Imagen del contenedor (ej. ecs.ContainerImage.fromAsset('../apps/api')) */
  readonly image: ecs.ContainerImage;
  readonly containerPort?: number;
  readonly healthCheckPath?: string;
  readonly environment?: Record<string, string>;
  readonly secrets?: Record<string, ecs.Secret>;
  readonly cpu?: number;
  readonly memoryLimitMiB?: number;
  readonly minCapacity?: number;
  readonly maxCapacity?: number;
  readonly removalPolicy?: cdk.RemovalPolicy;
  /** Bucket para los logs de acceso del ALB */
  readonly accessLogsBucket?: cdk.aws_s3.IBucket;
  /** Subredes de las tareas (por defecto públicas) */
  readonly taskSubnets?: ec2.SubnetSelection;
  /** IP pública en las tareas (por defecto true: necesaria sin NAT para llegar a ECR y a AWS) */
  readonly assignPublicIp?: boolean;
  /** Container Insights (tiene costo por métrica; por defecto false) */
  readonly containerInsights?: boolean;
}

export class CrediFlowFargateService extends Construct {
  public readonly cluster: ecs.Cluster;
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly targetGroup: elbv2.ApplicationTargetGroup;
  public readonly logGroup: logs.LogGroup;
  public readonly taskDefinition: ecs.FargateTaskDefinition;

  constructor(scope: Construct, id: string, props: CrediFlowFargateServiceProps) {
    super(scope, id);

    const port = props.containerPort ?? 3000;

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.vpc,
      clusterName: `${props.serviceName}-cluster`,
      containerInsightsV2: props.containerInsights ? ecs.ContainerInsights.ENABLED : ecs.ContainerInsights.DISABLED,
    });

    this.logGroup = new logs.LogGroup(this, 'Logs', {
      logGroupName: props.logGroupName,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.DESTROY,
    });

    const pattern = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Service', {
      cluster: this.cluster,
      serviceName: props.serviceName,
      loadBalancerName: `${props.serviceName}-alb`.slice(0, 32),
      cpu: props.cpu ?? 256,
      memoryLimitMiB: props.memoryLimitMiB ?? 512,
      desiredCount: props.minCapacity ?? 2,
      publicLoadBalancer: true,
      assignPublicIp: props.assignPublicIp ?? true,
      taskSubnets: props.taskSubnets ?? { subnetType: ec2.SubnetType.PUBLIC },
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.ARM64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
      taskImageOptions: {
        image: props.image,
        containerPort: port,
        containerName: 'api',
        environment: { PORT: String(port), ...props.environment },
        secrets: props.secrets,
        logDriver: ecs.LogDrivers.awsLogs({ logGroup: this.logGroup, streamPrefix: 'api' }),
      },
      circuitBreaker: { enable: true, rollback: true },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    });

    this.service = pattern.service;
    this.loadBalancer = pattern.loadBalancer;
    this.targetGroup = pattern.targetGroup;
    this.taskDefinition = pattern.taskDefinition;

    this.targetGroup.configureHealthCheck({
      path: props.healthCheckPath ?? '/health',
      interval: cdk.Duration.seconds(15),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
      timeout: cdk.Duration.seconds(5),
    });
    this.targetGroup.setAttribute('deregistration_delay.timeout_seconds', '15');

    if (props.accessLogsBucket) {
      this.loadBalancer.logAccessLogs(props.accessLogsBucket, `${props.serviceName}/alb`);
    }

    // Autoscaling: CPU y solicitudes por target
    const scaling = this.service.autoScaleTaskCount({
      minCapacity: props.minCapacity ?? 2,
      maxCapacity: props.maxCapacity ?? 6,
    });
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 60,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(30),
    });
    scaling.scaleOnRequestCount('RequestScaling', {
      requestsPerTarget: 200,
      targetGroup: this.targetGroup,
    });
  }

  /** URL pública del balanceador */
  get url(): string {
    return `http://${this.loadBalancer.loadBalancerDnsName}`;
  }
}
