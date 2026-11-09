/**
 * EventsStack (sesión 5): evaluación asíncrona con colas y eventos.
 *
 *  Flujo:
 *   API (ECS) --> SQS evaluaciones --> Lambda worker (idempotente, fuera de VPC)
 *       worker actualiza la tabla DynamoDB de solicitudes y publica "SolicitudEvaluada" en EventBridge
 *       EventBridge --> SNS (correo) y --> Lambda notificador (log/auditoría en DynamoDB)
 *
 *  - DLQ con alarma para mensajes que fallan 3 veces
 *  - Idempotencia con tabla DynamoDB (TTL 24 h) por messageId/solicitudId
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
  public readonly queue: CrediFlowQueue;
  public readonly bus: events.EventBus;
  public readonly notifications: AlertTopic;
  public readonly workerFn: CrediFlowFunction;
  public readonly idempotencyTable: CrediFlowTable;

  constructor(scope: Construct, id: string, props: EventsStackProps) {
    super(scope, id, props);

    const workerTimeout = cdk.Duration.seconds(30);

    // ---- Cola + DLQ ------------------------------------------------------
    this.queue = new CrediFlowQueue(this, 'Evaluaciones', {
      queueName: this.names.queue('evaluaciones'),
      consumerTimeout: workerTimeout,
      maxReceiveCount: 3,
    });

    // ---- Idempotencia ----------------------------------------------------
    this.idempotencyTable = new CrediFlowTable(this, 'Idempotencia', {
      tableName: this.names.table('idempotencia'),
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'expiresAt',
      removalPolicy: this.removalPolicy,
    });

    // ---- Bus de eventos --------------------------------------------------
    this.bus = new events.EventBus(this, 'Bus', { eventBusName: this.names.resource('bus') });

    // ---- Worker ----------------------------------------------------------
    this.workerFn = new CrediFlowFunction(this, 'WorkerFn', {
      functionName: this.names.lambda('evaluador'),
      logGroupName: this.names.logGroup('fn-evaluador'),
      entry: path.join(HANDLERS, 'evaluador.ts'),
      serviceName: 'evaluador',
      timeout: workerTimeout,
      memorySize: 256,
      environment: {
        TABLE_NAME: props.solicitudes.table.tableName,
        IDEMPOTENCY_TABLE: this.idempotencyTable.table.tableName,
        EVENT_BUS_NAME: this.bus.eventBusName,
        // Simulador de fallas para la sesión 6 (0 = sin fallas, 0.5 = 50 %)
        FAILURE_RATE: '0',
      },
      removalPolicy: this.removalPolicy,
    });
    this.workerFn.fn.addEventSource(
      new lambdaEvents.SqsEventSource(this.queue.queue, {
        batchSize: 5,
        reportBatchItemFailures: true,
        maxConcurrency: 5,
      }),
    );
    props.solicitudes.table.grantReadWriteData(this.workerFn.fn);
    this.idempotencyTable.table.grantReadWriteData(this.workerFn.fn);
    this.bus.grantPutEventsTo(this.workerFn.fn);

    // ---- Notificaciones --------------------------------------------------
    this.notifications = new AlertTopic(this, 'Notificaciones', {
      topicName: this.names.topic('notificaciones'),
      email: this.cfg.alertEmail || undefined,
      displayName: 'CrediFlow notificaciones',
    });

    const notificadorFn = new CrediFlowFunction(this, 'NotificadorFn', {
      functionName: this.names.lambda('notificador'),
      logGroupName: this.names.logGroup('fn-notificador'),
      entry: path.join(HANDLERS, 'notificador.ts'),
      serviceName: 'notificador',
      removalPolicy: this.removalPolicy,
    });

    // Regla: solo eventos de solicitudes evaluadas (filtrado por patrón)
    new events.Rule(this, 'SolicitudEvaluadaRule', {
      ruleName: this.names.resource('rule-evaluada'),
      eventBus: this.bus,
      description: 'Notifica el resultado de cada solicitud evaluada',
      eventPattern: {
        source: ['crediflow.evaluador'],
        detailType: ['SolicitudEvaluada'],
      },
      targets: [
        new targets.SnsTopic(this.notifications.topic, {
          message: events.RuleTargetInput.fromText(
            `CrediFlow: la solicitud ${events.EventField.fromPath('$.detail.solicitudId')} fue ${events.EventField.fromPath('$.detail.resultado')} (monto ${events.EventField.fromPath('$.detail.monto')}).`,
          ),
        }),
        new targets.LambdaFunction(notificadorFn.fn),
      ],
    });

    // Regla: solo rechazos de alto monto (ejemplo de filtrado por contenido)
    new events.Rule(this, 'RechazoAltoMontoRule', {
      ruleName: this.names.resource('rule-rechazo-alto'),
      eventBus: this.bus,
      eventPattern: {
        source: ['crediflow.evaluador'],
        detailType: ['SolicitudEvaluada'],
        detail: { resultado: ['RECHAZADA'], monto: [{ numeric: ['>=', 20000] }] },
      },
      targets: [new targets.LambdaFunction(notificadorFn.fn)],
    });

    // Alarmas -> correo
    this.notifications.bind(this.queue.dlqAlarm);

    // ---- Salidas ---------------------------------------------------------
    this.crossStackExport('QueueUrl', this.queue.queue.queueUrl, 'URL de la cola de evaluaciones');
    this.crossStackExport('EventBusName', this.bus.eventBusName);
    this.publishParameter('QueueUrlParam', 'queue-url', this.queue.queue.queueUrl);
    this.publishParameter('DlqUrlParam', 'dlq-url', this.queue.deadLetterQueue.queueUrl);
    this.publishParameter('BusParam', 'event-bus', this.bus.eventBusName);
  }
}
