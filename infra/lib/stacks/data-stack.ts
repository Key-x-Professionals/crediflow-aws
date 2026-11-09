/**
 * DataStack (sesión 3): almacenamiento y base de datos.
 *
 * TODO (laboratorio, parte C):
 *   1. logsBucket: SecureBucket 'logs' (versiones antiguas expiran a los 7 días)
 *   2. documentsBucket: SecureBucket 'documentos' con logs de acceso en logsBucket
 *   3. solicitudes: CrediFlowTable this.names.table('solicitudes'), clave 'id' (STRING),
 *      índices 'porFecha' (gsi1pk + creadaEn) y 'porEstado' (estado + creadaEn),
 *      pointInTimeRecovery solo si this.cfg.isProd
 *   4. Exports: SolicitudesTableName, DocumentsBucketName; parámetros SSM: solicitudes-table, documents-bucket
 *
 * Nota de costo: DynamoDB bajo demanda no cobra por hora (25 GB siempre gratis).
 * Este stack NO necesita el VPC: nada aquí vive dentro de una red.
 */
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import { CrediFlowTable, SecureBucket } from '../constructs';
import { CrediFlowStack, CrediFlowStackProps } from '../crediflow-stack';

export class DataStack extends CrediFlowStack {
  public readonly solicitudes!: CrediFlowTable;
  public readonly documentsBucket!: SecureBucket;
  public readonly logsBucket!: SecureBucket;

  constructor(scope: Construct, id: string, props: CrediFlowStackProps) {
    super(scope, id, props);
    void dynamodb; // elimina esta línea al completar el TODO

    // TODO: this.logsBucket = new SecureBucket(this, 'LogsBucket', { ... });
    // TODO: this.documentsBucket = new SecureBucket(this, 'DocumentsBucket', { ... });
    // TODO: this.solicitudes = new CrediFlowTable(this, 'Solicitudes', { ... });
    // TODO: exports y parámetros SSM
  }
}
