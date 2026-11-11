/**
 * DataStack (sesión 3): datos y almacenamiento, a costo casi cero.
 *
 *  - Tabla DynamoDB `solicitudes` (bajo demanda, 25 GB siempre gratis)
 *      pk = id de la solicitud
 *      GSI `porFecha`:  gsi1pk = "SOLICITUD", gsi1sk = creadaEn  → listar las últimas
 *      GSI `porEstado`: estado, creadaEn                         → filtrar por estado
 *  - Bucket de documentos (cifrado, versionado, privado)
 *  - Bucket de logs de acceso (ALB, S3)
 *
 *  Nota: en la sesión 2 la base de datos fue PostgreSQL en RDS para conocer el servicio;
 *  desde aquí CrediFlow usa DynamoDB porque no tiene costo fijo por hora, no necesita
 *  VPC ni secretos, y escala solo. Es una decisión de costo y operación, no de "mejor motor".
 */
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { CrediFlowTable, SecureBucket } from '../constructs';
import { CrediFlowStack, CrediFlowStackProps } from '../crediflow-stack';

export class DataStack extends CrediFlowStack {
  public readonly solicitudes: CrediFlowTable;
  public readonly documentsBucket: SecureBucket;
  public readonly logsBucket: SecureBucket;

  constructor(scope: Construct, id: string, props: CrediFlowStackProps) {
    super(scope, id, props);

    this.logsBucket = new SecureBucket(this, 'LogsBucket', {
      bucketName: this.names.bucket('logs'),
      removalPolicy: this.removalPolicy,
      noncurrentVersionExpirationDays: 7,
    });

    this.documentsBucket = new SecureBucket(this, 'DocumentsBucket', {
      bucketName: this.names.bucket('documentos'),
      removalPolicy: this.removalPolicy,
      serverAccessLogsBucket: this.logsBucket.bucket,
    });

    this.solicitudes = new CrediFlowTable(this, 'Solicitudes', {
      tableName: this.names.table('solicitudes'),
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      pointInTimeRecovery: this.cfg.isProd,
      removalPolicy: this.removalPolicy,
      globalSecondaryIndexes: [
        {
          indexName: 'porFecha',
          partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'creadaEn', type: dynamodb.AttributeType.STRING },
        },
        {
          indexName: 'porEstado',
          partitionKey: { name: 'estado', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'creadaEn', type: dynamodb.AttributeType.STRING },
        },
      ],
    });

    this.crossStackExport('SolicitudesTableName', this.solicitudes.table.tableName, 'Tabla DynamoDB de solicitudes');
    this.crossStackExport('DocumentsBucketName', this.documentsBucket.bucket.bucketName);
    this.publishParameter('SolicitudesTableParam', 'solicitudes-table', this.solicitudes.table.tableName);
    this.publishParameter('DocsBucketParam', 'documents-bucket', this.documentsBucket.bucket.bucketName);
  }
}
