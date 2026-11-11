import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { NetworkStack } from '../lib/stacks/network-stack';
import { testConfig } from './helpers';

describe('NetworkStack', () => {
  const app = new cdk.App();
  const stack = new NetworkStack(app, 'Network', { config: testConfig, session: 3 });
  const template = Template.fromStack(stack);

  it('crea un VPC con 4 subredes (públicas y aisladas x 2 AZ)', () => {
    template.resourceCountIs('AWS::EC2::VPC', 1);
    template.resourceCountIs('AWS::EC2::Subnet', 4);
  });

  it('no crea NAT Gateways en dev (costo fijo de ~32 USD/mes cada uno)', () => {
    template.resourceCountIs('AWS::EC2::NatGateway', 0);
  });

  it('activa flow logs', () => {
    template.resourceCountIs('AWS::EC2::FlowLog', 1);
  });

  it('etiqueta los recursos con Student y Environment', () => {
    template.hasResourceProperties('AWS::EC2::VPC', {
      Tags: Match.arrayWith([
        { Key: 'Environment', Value: 'dev' },
        { Key: 'Student', Value: 'test' },
      ]),
    });
  });
});
