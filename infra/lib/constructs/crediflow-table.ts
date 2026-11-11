/**
 * CrediFlowTable: tabla DynamoDB con buenas prácticas y costo casi cero.
 *
 *  - Facturación bajo demanda: sin capacidad reservada; a la escala del curso
 *    (cientos de operaciones) cuesta centavos. 25 GB de almacenamiento siempre gratis.
 *  - Cifrado administrado por AWS
 *  - Point-in-time recovery opcional (por defecto solo en prod: tiene costo por GB)
 *  - TTL opcional para registros de idempotencia
 *  - Índices secundarios globales opcionales
 */
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface CrediFlowTableProps {
  readonly tableName: string;
  readonly partitionKey: dynamodb.Attribute;
  readonly sortKey?: dynamodb.Attribute;
  readonly timeToLiveAttribute?: string;
  readonly removalPolicy?: cdk.RemovalPolicy;
  readonly globalSecondaryIndexes?: dynamodb.GlobalSecondaryIndexPropsV2[];
  /** Recuperación a un punto en el tiempo (costo por GB-mes). Por defecto false. */
  readonly pointInTimeRecovery?: boolean;
}

export class CrediFlowTable extends Construct {
  public readonly table: dynamodb.TableV2;

  constructor(scope: Construct, id: string, props: CrediFlowTableProps) {
    super(scope, id);

    this.table = new dynamodb.TableV2(this, 'Table', {
      tableName: props.tableName,
      partitionKey: props.partitionKey,
      sortKey: props.sortKey,
      billing: dynamodb.Billing.onDemand(),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: props.pointInTimeRecovery ?? false },
      encryption: dynamodb.TableEncryptionV2.awsManagedKey(),
      timeToLiveAttribute: props.timeToLiveAttribute,
      removalPolicy: props.removalPolicy ?? cdk.RemovalPolicy.RETAIN,
      globalSecondaryIndexes: props.globalSecondaryIndexes,
    });
  }
}
