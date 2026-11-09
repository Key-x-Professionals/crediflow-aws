/**
 * Name builders y ARN builders de CrediFlow.
 *
 * Convención de nombres:  <project>-<student>-<env>-<recurso>
 * Ejemplo:                crediflow-edgar-dev-api
 *
 * Con esto cada alumno puede identificar sus recursos en la consola y en
 * Cost Explorer (filtrando por nombre o por la etiqueta "Student").
 */
import { CrediFlowConfig } from './config';

export class NameBuilder {
  constructor(private readonly cfg: CrediFlowConfig) {}

  /** Prefijo base: crediflow-<student>-<env> */
  get prefix(): string {
    return `${this.cfg.project}-${this.cfg.student}-${this.cfg.env}`;
  }

  /** Nombre genérico de recurso: crediflow-edgar-dev-<suffix> */
  resource(suffix: string): string {
    return `${this.prefix}-${suffix}`;
  }

  /** Nombre de stack en CloudFormation: CrediFlow-edgar-dev-Network */
  stack(name: string): string {
    const student = this.cfg.student.replace(/[^a-zA-Z0-9]/g, '');
    return `CrediFlow-${student}-${this.cfg.env}-${name}`;
  }

  /** Buckets S3: globales y en minúsculas; agregamos cuenta y región para unicidad */
  bucket(suffix: string): string {
    return `${this.prefix}-${suffix}-${this.cfg.account}-${this.cfg.region}`.toLowerCase();
  }

  /** Secrets Manager: crediflow/edgar/dev/db */
  secret(suffix: string): string {
    return `${this.cfg.project}/${this.cfg.student}/${this.cfg.env}/${suffix}`;
  }

  /** SSM Parameter Store: /crediflow/edgar/dev/api-url */
  parameter(suffix: string): string {
    return `/${this.cfg.project}/${this.cfg.student}/${this.cfg.env}/${suffix}`;
  }

  /** Log groups: /crediflow/edgar/dev/api */
  logGroup(suffix: string): string {
    return `/${this.cfg.project}/${this.cfg.student}/${this.cfg.env}/${suffix}`;
  }

  /** Nombre de export de CloudFormation: crediflow-edgar-dev:VpcId */
  export(suffix: string): string {
    return `${this.prefix}:${suffix}`;
  }

  /** Nombre de función Lambda (máx. 64 caracteres) */
  lambda(suffix: string): string {
    return this.resource(`fn-${suffix}`).slice(0, 64);
  }

  /** Nombre de tabla DynamoDB */
  table(suffix: string): string {
    return this.resource(`tbl-${suffix}`);
  }

  /** Nombre de cola SQS */
  queue(suffix: string): string {
    return this.resource(`q-${suffix}`);
  }

  /** Nombre de topic SNS */
  topic(suffix: string): string {
    return this.resource(`topic-${suffix}`);
  }

  /** Nombre de rol IAM */
  role(suffix: string): string {
    return this.resource(`role-${suffix}`);
  }
}

/**
 * ArnBuilder: construye ARNs sin tener que recordar el formato de cada servicio.
 * Útil para políticas IAM de mínimo privilegio y para importar recursos existentes.
 */
export class ArnBuilder {
  constructor(private readonly cfg: CrediFlowConfig) {}

  private get base(): string {
    return `arn:aws`;
  }

  s3Bucket(bucketName: string): string {
    return `${this.base}:s3:::${bucketName}`;
  }

  s3Objects(bucketName: string, prefix = '*'): string {
    return `${this.base}:s3:::${bucketName}/${prefix}`;
  }

  dynamoTable(tableName: string): string {
    return `${this.base}:dynamodb:${this.cfg.region}:${this.cfg.account}:table/${tableName}`;
  }

  sqsQueue(queueName: string): string {
    return `${this.base}:sqs:${this.cfg.region}:${this.cfg.account}:${queueName}`;
  }

  snsTopic(topicName: string): string {
    return `${this.base}:sns:${this.cfg.region}:${this.cfg.account}:${topicName}`;
  }

  lambdaFunction(functionName: string): string {
    return `${this.base}:lambda:${this.cfg.region}:${this.cfg.account}:function:${functionName}`;
  }

  secret(secretName: string): string {
    // Secrets Manager añade un sufijo aleatorio de 6 caracteres al ARN
    return `${this.base}:secretsmanager:${this.cfg.region}:${this.cfg.account}:secret:${secretName}-*`;
  }

  parameter(parameterName: string): string {
    const name = parameterName.startsWith('/') ? parameterName.slice(1) : parameterName;
    return `${this.base}:ssm:${this.cfg.region}:${this.cfg.account}:parameter/${name}`;
  }

  logGroup(logGroupName: string): string {
    return `${this.base}:logs:${this.cfg.region}:${this.cfg.account}:log-group:${logGroupName}:*`;
  }

  role(roleName: string): string {
    return `${this.base}:iam::${this.cfg.account}:role/${roleName}`;
  }

  eventBus(busName: string): string {
    return `${this.base}:events:${this.cfg.region}:${this.cfg.account}:event-bus/${busName}`;
  }

  ecrRepository(repoName: string): string {
    return `${this.base}:ecr:${this.cfg.region}:${this.cfg.account}:repository/${repoName}`;
  }

  cloudformationStack(stackName: string): string {
    return `${this.base}:cloudformation:${this.cfg.region}:${this.cfg.account}:stack/${stackName}/*`;
  }
}
