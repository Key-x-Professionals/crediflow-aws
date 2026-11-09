/**
 * EventsStack (sesión 5): evaluación asíncrona con colas y eventos.
 *
 *  Flujo:
 *   API (ECS) --> SQS evaluaciones --> Lambda worker (idempotente, fuera de VPC)
 *       worker actualiza la tabla DynamoDB de solicitudes y publica "SolicitudEvaluada" en EventBridge
 *       EventBridge --> SNS (correo) y --> Lambda notificador
 *
 * TODO (laboratorio, parte B):
 *   1. queue: CrediFlowQueue 'evaluaciones' (consumerTimeout 30 s, 3 reintentos)
 *   2. idempotencyTable: CrediFlowTable 'idempotencia' con TTL 'expiresAt'
 *   3. bus: EventBus this.names.resource('bus')
 *   4. workerFn: CrediFlowFunction (sin VPC: DynamoDB se alcanza por internet con IAM), memoria 256,
 *      env TABLE_NAME, IDEMPOTENCY_TABLE, EVENT_BUS_NAME, FAILURE_RATE=0
 *      - SqsEventSource (batchSize 5, reportBatchItemFailures, maxConcurrency 5)
 *      - permisos: solicitudes.table.grantReadWriteData(fn), idempotencyTable grantReadWriteData, bus.grantPutEventsTo
 *   5. notifications: AlertTopic 'notificaciones' con this.cfg.alertEmail; notificadorFn
 *   6. Reglas: SolicitudEvaluada → SNS (mensaje con RuleTargetInput) + notificador; RECHAZADA y monto >= 20000 → notificador
 *   7. notifications.bind(queue.dlqAlarm); exports QueueUrl, EventBusName; parámetros queue-url, dlq-url, event-bus
 */
import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambdaEvents from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import { AlertTopic, CrediFlowFunction, CrediFlowQueue, CrediFlowTable } from '../constructs';
import { CrediFlowStack, CrediFlowStackProps } from '../crediflow-stack';

const HANDLERS = path.join(__dirname, '..', '..', '..', 'apps', 'worker', 'src');

export interface EventsStackProps extends CrediFlowStackProps {
  /** Tabla de solicitudes que el worker actualiza */
  readonly solicitudes: CrediFlowTable;
}

export class EventsStack extends CrediFlowStack {
  public readonly queue!: CrediFlowQueue;
  public readonly bus!: events.EventBus;
  public readonly notifications!: AlertTopic;
  public readonly workerFn!: CrediFlowFunction;
  public readonly idempotencyTable!: CrediFlowTable;

  constructor(scope: Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);
    void HANDLERS; void cdk; void dynamodb; void targets; void lambdaEvents; // elimina al completar el TODO

    // TODO: cola + DLQ
    // TODO: idempotencia
    // TODO: bus de eventos
    // TODO: worker
    // TODO: notificaciones y reglas
    // TODO: salidas
  }
}
