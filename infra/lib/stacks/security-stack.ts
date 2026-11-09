/**
 * SecurityStack (sesión 6): perímetro y detección.
 *
 * TODO (laboratorio, parte B):
 *   1. webAcl: wafv2.CfnWebACL REGIONAL con reglas administradas (CommonRuleSet, KnownBadInputs,
 *      AmazonIpReputationList) y una rateBasedStatement (500 por IP)
 *   2. Asociar al ALB (loadBalancerArn) y a la etapa de API Gateway (deploymentStage.stageArn)
 *   3. Logs del WAF en un log group 'aws-waf-logs-<prefijo>'
 *   4. Si props.accountLevelSecurity: GuardDuty CfnDetector y cloudtrail.Trail hacia logsBucket
 */
import * as cdk from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as guardduty from 'aws-cdk-lib/aws-guardduty';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';
import { SecureBucket } from '../constructs';
import { CrediFlowStack, CrediFlowStackProps } from '../crediflow-stack';

export interface SecurityStackProps extends CrediFlowStackProps {
  readonly loadBalancer: elbv2.IApplicationLoadBalancer;
  readonly restApi: apigw.RestApi;
  readonly logsBucket: SecureBucket;
  /** Crea GuardDuty + CloudTrail (una vez por cuenta) */
  readonly accountLevelSecurity?: boolean;
}

export class SecurityStack extends CrediFlowStack {
  public readonly webAcl!: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);
    void cdk; void cloudtrail; void guardduty; void logs; // elimina al completar el TODO

    // TODO: WebACL + asociaciones + logging
    // TODO: GuardDuty y CloudTrail (nivel de cuenta)
  }
}
