/**
 * ObservabilityStack (sesión 6): dashboard, alarmas y señales doradas.
 *
 * TODO (laboratorio, parte C):
 *   1. alerts: AlertTopic 'alertas' con this.cfg.alertEmail
 *   2. Métricas: ALB (requestCount, 5xx ELB y target, p95), target group (healthyHostCount), ECS (cpu, memoria),
 *      API Gateway (count, serverError, latency p95), Lambda errores (MathExpression precal + worker),
 *      SQS (visible, edad del mensaje más antiguo, DLQ), negocio (namespace CrediFlow, dimensión service=evaluador)
 *   3. Alarmas: api-5xx (>= 5 en 2 min), api-latencia (p95 > 1 s, 3 min), api-hosts (< 2), lambda-errores (>= 3),
 *      cola-antiguedad (> 300 s), dlq (>= 1). Descripción con el runbook. alerts.bind(...)
 *   4. Dashboard de 4 filas: tráfico/errores/latencia · saturación/cola/errores Lambda · negocio · AlarmStatusWidget
 *   5. Output DashboardUrl
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
  public readonly dashboard!: cloudwatch.Dashboard;
  public readonly alerts!: AlertTopic;

  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);
    void cdk; // elimina al completar el TODO

    // TODO: topic de alertas
    // TODO: métricas
    // TODO: alarmas
    // TODO: dashboard
  }
}
