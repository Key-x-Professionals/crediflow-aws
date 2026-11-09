/**
 * AlertTopic: topic SNS para alarmas y notificaciones con suscripción por correo.
 *
 * Incluye el helper `bind(alarm)` para conectar cualquier alarma de CloudWatch
 * (acción en ALARM y en OK).
 */
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface AlertTopicProps {
  readonly topicName: string;
  readonly email?: string;
  readonly displayName?: string;
}

export class AlertTopic extends Construct {
  public readonly topic: sns.Topic;

  constructor(scope: Construct, id: string, props: AlertTopicProps) {
    super(scope, id);

    this.topic = new sns.Topic(this, 'Topic', {
      topicName: props.topicName,
      displayName: props.displayName ?? 'CrediFlow',
      enforceSSL: true,
    });

    if (props.email) {
      this.topic.addSubscription(new subs.EmailSubscription(props.email));
    }
  }

  /** Conecta una o varias alarmas a este topic */
  bind(...alarms: cloudwatch.Alarm[]): void {
    const action = new cwActions.SnsAction(this.topic);
    for (const alarm of alarms) {
      alarm.addAlarmAction(action);
      alarm.addOkAction(action);
    }
  }
}
