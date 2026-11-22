/**
 * ObservabilityStack (sesión 6): dashboard, alarmas y señales doradas.
 *
 *  Señales doradas de CrediFlow:
 *   - Latencia:     p95 del ALB y de la API de precalificación
 *   - Tráfico:      solicitudes por minuto en ALB y API Gateway
 *   - Errores:      5xx del ALB, errores de Lambda, mensajes en DLQ
 *   - Saturación:   CPU/memoria del servicio ECS, profundidad de la cola
 *
 *  Métricas de negocio (namespace CrediFlow, emitidas por el worker con Powertools):
 *   - SolicitudesEvaluadas, SolicitudesAprobadas, SolicitudesRechazadas
 *
 * El stack viene casi completo para que lo LEAS. Te toca escribir (TODO del bloque C):
 * la alarma de tareas sanas y el widget de saturación del dashboard.
 */
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { AlertTopic, CrediFlowFargateService, CrediFlowFunction, CrediFlowQueue, CrediFlowRestApi } from '../constructs';
import { CrediFlowStack, CrediFlowStackProps } from '../crediflow-stack';

export interface ObservabilityStackProps extends CrediFlowStackProps {
  readonly api: CrediFlowFargateService;
  readonly precalApi: CrediFlowRestApi;
  readonly precalificarFn: CrediFlowFunction;
  readonly workerFn: CrediFlowFunction;
  readonly queue: CrediFlowQueue;
}

export class ObservabilityStack extends CrediFlowStack {
  public readonly dashboard: cloudwatch.Dashboard;
  public readonly alerts: AlertTopic;

  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const period = cdk.Duration.minutes(1);

    this.alerts = new AlertTopic(this, 'Alertas', {
      topicName: this.names.topic('alertas'),
      email: this.cfg.alertEmail || undefined,
      displayName: 'CrediFlow alertas',
    });

    // ---- Métricas --------------------------------------------------------
    const alb = props.api.loadBalancer;
    const tg = props.api.targetGroup;

    const albRequests = alb.metrics.requestCount({ period, statistic: 'Sum' });
    const alb5xx = alb.metrics.httpCodeElb(cdk.aws_elasticloadbalancingv2.HttpCodeElb.ELB_5XX_COUNT, { period, statistic: 'Sum' });
    const target5xx = tg.metrics.httpCodeTarget(cdk.aws_elasticloadbalancingv2.HttpCodeTarget.TARGET_5XX_COUNT, { period, statistic: 'Sum' });
    const albLatencyP95 = tg.metrics.targetResponseTime({ period, statistic: 'p95' });
    const healthyHosts = tg.metrics.healthyHostCount({ period, statistic: 'Minimum' });

    const ecsCpu = props.api.service.metricCpuUtilization({ period });
    const ecsMem = props.api.service.metricMemoryUtilization({ period });
    void ecsCpu; void ecsMem; // elimina esta línea al completar el TODO del widget

    const apigwRequests = props.precalApi.api.metricCount({ period, statistic: 'Sum' });
    const apigw5xx = props.precalApi.api.metricServerError({ period, statistic: 'Sum' });
    const apigwLatencyP95 = props.precalApi.api.metricLatency({ period, statistic: 'p95' });

    const lambdaErrors = new cloudwatch.MathExpression({
      expression: 'precal + worker',
      usingMetrics: {
        precal: props.precalificarFn.fn.metricErrors({ period, statistic: 'Sum' }),
        worker: props.workerFn.fn.metricErrors({ period, statistic: 'Sum' }),
      },
      label: 'Errores Lambda',
      period,
    });

    const queueDepth = props.queue.queue.metricApproximateNumberOfMessagesVisible({ period, statistic: 'Maximum' });
    const queueAge = props.queue.queue.metricApproximateAgeOfOldestMessage({ period, statistic: 'Maximum' });
    const dlqDepth = props.queue.deadLetterQueue.metricApproximateNumberOfMessagesVisible({ period, statistic: 'Maximum' });

    const business = (name: string) =>
      new cloudwatch.Metric({
        namespace: 'CrediFlow',
        metricName: name,
        dimensionsMap: { service: 'evaluador' },
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
        label: name,
      });

    // ---- Alarmas ---------------------------------------------------------
    const alarm5xx = new cloudwatch.Alarm(this, 'Alb5xxAlarm', {
      alarmName: this.names.resource('alarm-api-5xx'),
      alarmDescription: 'La API devuelve errores 5xx. Runbook RB-01.',
      metric: new cloudwatch.MathExpression({
        expression: 'elb + target',
        usingMetrics: { elb: alb5xx, target: target5xx },
        period,
      }),
      threshold: 5,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const alarmLatency = new cloudwatch.Alarm(this, 'LatencyAlarm', {
      alarmName: this.names.resource('alarm-api-latencia'),
      alarmDescription: 'p95 de latencia de la API por encima de 1 s. Runbook RB-01.',
      metric: albLatencyP95,
      threshold: 1,
      evaluationPeriods: 3,
      datapointsToAlarm: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // TODO (bloque C): la alarma que falta, 'HealthyHostsAlarm' (alarm-api-hosts):
    //   "menos de 2 tareas sanas detrás del balanceador" → metric: healthyHosts, threshold: 2,
    //   evaluationPeriods: 2, comparisonOperator LESS_THAN_THRESHOLD y, ojo, treatMissingData BREACHING
    //   (si no hay datos es que no hay tareas). Guárdala en const alarmHealthy.
    void healthyHosts; // elimina esta línea al completar el TODO

    const alarmLambda = new cloudwatch.Alarm(this, 'LambdaErrorsAlarm', {
      alarmName: this.names.resource('alarm-lambda-errores'),
      alarmDescription: 'Errores en funciones Lambda. Runbook RB-02.',
      metric: lambdaErrors,
      threshold: 3,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    const alarmQueueAge = new cloudwatch.Alarm(this, 'QueueAgeAlarm', {
      alarmName: this.names.resource('alarm-cola-antiguedad'),
      alarmDescription: 'Mensajes esperando más de 5 minutos en la cola. Runbook RB-02.',
      metric: queueAge,
      threshold: 300,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // La alarma de DLQ se define aquí (no se reutiliza la del EventsStack) para
    // que Events nunca dependa de Observability.
    const alarmDlq = new cloudwatch.Alarm(this, 'DlqAlarm', {
      alarmName: this.names.resource('alarm-dlq'),
      alarmDescription: 'Mensajes en la cola de errores. Runbook RB-02.',
      metric: dlqDepth,
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // TODO (bloque C): agrega alarmHealthy a esta lista para que también avise por correo
    this.alerts.bind(alarm5xx, alarmLatency, alarmLambda, alarmQueueAge, alarmDlq);

    // ---- Dashboard -------------------------------------------------------
    this.dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: this.names.resource('dashboard'),
      defaultInterval: cdk.Duration.hours(1),
    });

    this.dashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: `# CrediFlow · ${this.cfg.student} · ${this.cfg.env}\n**Señales doradas**: latencia · tráfico · errores · saturación. Alarmas → ${this.alerts.topic.topicName}`,
        width: 24,
        height: 2,
      }),
    );
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({ title: 'Tráfico: solicitudes/min', left: [albRequests, apigwRequests], width: 8 }),
      new cloudwatch.GraphWidget({ title: 'Errores 5xx', left: [alb5xx, target5xx, apigw5xx], width: 8 }),
      new cloudwatch.GraphWidget({ title: 'Latencia p95 (s)', left: [albLatencyP95], right: [apigwLatencyP95], width: 8 }),
    );
    this.dashboard.addWidgets(
      // TODO (bloque C): el widget de saturación → GraphWidget 'Saturación ECS (%)' con left: [ecsCpu, ecsMem], width: 8
      new cloudwatch.GraphWidget({ title: 'Cola de evaluaciones', left: [queueDepth, dlqDepth], right: [queueAge], width: 8 }),
      new cloudwatch.GraphWidget({ title: 'Errores Lambda', left: [lambdaErrors], width: 8 }),
    );
    this.dashboard.addWidgets(
      new cloudwatch.SingleValueWidget({ title: 'Evaluadas (5 min)', metrics: [business('SolicitudesEvaluadas')], width: 6 }),
      new cloudwatch.SingleValueWidget({ title: 'Aprobadas (5 min)', metrics: [business('SolicitudesAprobadas')], width: 6 }),
      new cloudwatch.SingleValueWidget({ title: 'Rechazadas (5 min)', metrics: [business('SolicitudesRechazadas')], width: 6 }),
      new cloudwatch.AlarmStatusWidget({
        title: 'Alarmas',
        alarms: [alarm5xx, alarmLatency, alarmLambda, alarmQueueAge, alarmDlq], // TODO (bloque C): agrega alarmHealthy
        width: 6,
      }),
    );

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
    });
  }
}
