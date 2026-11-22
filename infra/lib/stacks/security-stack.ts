/**
 * SecurityStack (sesión 6): perímetro y detección.
 *
 *  - AWS WAF (WebACL regional) con reglas administradas de AWS y límite de tasa,
 *    asociado al ALB de la API y a la etapa de API Gateway
 *  - GuardDuty y CloudTrail: son recursos ÚNICOS por cuenta/región.
 *    Solo se crean cuando CF_ACCOUNT_SECURITY=true (normalmente los despliega el instructor una vez).
 *
 * El stack viene casi completo para que lo LEAS. Te toca escribir (TODO del bloque B):
 * la regla de límite de tasa y la asociación del WAF a la API de precalificación.
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
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id, props);

    const managedRule = (name: string, priority: number, vendor = 'AWS'): wafv2.CfnWebACL.RuleProperty => ({
      name,
      priority,
      overrideAction: { none: {} },
      statement: { managedRuleGroupStatement: { vendorName: vendor, name } },
      visibilityConfig: { sampledRequestsEnabled: true, cloudWatchMetricsEnabled: true, metricName: name },
    });

    this.webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      name: this.names.resource('waf'),
      scope: 'REGIONAL',
      defaultAction: { allow: {} },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: this.names.resource('waf'),
      },
      rules: [
        managedRule('AWSManagedRulesCommonRuleSet', 1),
        managedRule('AWSManagedRulesKnownBadInputsRuleSet', 2),
        managedRule('AWSManagedRulesAmazonIpReputationList', 3),
        // TODO (bloque B): regla de límite de tasa 'RateLimitPorIp' (priority 10, action: { block: {} }):
        //   statement: { rateBasedStatement: { limit: 500, aggregateKeyType: 'IP' } }
        //   y el mismo visibilityConfig de las demás, con metricName 'RateLimitPorIp'
      ],
    });

    new wafv2.CfnWebACLAssociation(this, 'AlbAssociation', {
      resourceArn: props.loadBalancer.loadBalancerArn,
      webAclArn: this.webAcl.attrArn,
    });

    // TODO (bloque B): asocia el mismo WebACL a la etapa de API Gateway (precalificación):
    //   new wafv2.CfnWebACLAssociation(this, 'ApiAssociation', { resourceArn: props.restApi.deploymentStage.stageArn, ... })

    // Logs del WAF (el nombre del log group DEBE empezar con aws-waf-logs-)
    const wafLogs = new logs.LogGroup(this, 'WafLogs', {
      logGroupName: `aws-waf-logs-${this.names.prefix}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: this.removalPolicy,
    });
    new wafv2.CfnLoggingConfiguration(this, 'WafLogging', {
      resourceArn: this.webAcl.attrArn,
      logDestinationConfigs: [wafLogs.logGroupArn],
    });

    if (props.accountLevelSecurity) {
      new guardduty.CfnDetector(this, 'GuardDuty', {
        enable: true,
        findingPublishingFrequency: 'FIFTEEN_MINUTES',
      });

      new cloudtrail.Trail(this, 'Trail', {
        trailName: this.names.resource('trail'),
        bucket: props.logsBucket.bucket,
        s3KeyPrefix: 'cloudtrail',
        sendToCloudWatchLogs: true,
        cloudWatchLogsRetention: logs.RetentionDays.ONE_WEEK,
        enableFileValidation: true,
        isMultiRegionTrail: false,
      });
    }

    new cdk.CfnOutput(this, 'WebAclArn', { value: this.webAcl.attrArn });
  }
}
