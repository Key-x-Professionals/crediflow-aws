/**
 * CrediFlowQueue: cola SQS con cola de errores (DLQ) y alarma.
 *
 *  - Cifrado administrado por SQS
 *  - DLQ con 3 reintentos (maxReceiveCount)
 *  - Visibility timeout = 6x el timeout de la Lambda consumidora (recomendación AWS)
 *  - Alarma si llega cualquier mensaje a la DLQ
 */
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface CrediFlowQueueProps {
  readonly queueName: string;
  readonly maxReceiveCount?: number;
  /** Timeout de la función consumidora; el visibility timeout será 6x */
  readonly consumerTimeout?: cdk.Duration;
  readonly retentionPeriod?: cdk.Duration;
}

export class CrediFlowQueue extends Construct {
  public readonly queue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly dlqAlarm: cloudwatch.Alarm;

  constructor(scope: Construct, id: string, props: CrediFlowQueueProps) {
    super(scope, id);

    const consumerTimeout = props.consumerTimeout ?? cdk.Duration.seconds(30);

    this.deadLetterQueue = new sqs.Queue(this, 'Dlq', {
      queueName: `${props.queueName}-dlq`,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      retentionPeriod: cdk.Duration.days(14),
    });

    this.queue = new sqs.Queue(this, 'Queue', {
      queueName: props.queueName,
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      visibilityTimeout: cdk.Duration.seconds(consumerTimeout.toSeconds() * 6),
      retentionPeriod: props.retentionPeriod ?? cdk.Duration.days(4),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: props.maxReceiveCount ?? 3,
      },
    });

    this.dlqAlarm = new cloudwatch.Alarm(this, 'DlqAlarm', {
      alarmName: `${props.queueName}-dlq-messages`,
      alarmDescription: 'Hay mensajes en la cola de errores: revisar runbook RB-02',
      metric: this.deadLetterQueue.metricApproximateNumberOfMessagesVisible({ period: cdk.Duration.minutes(1) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }
}
