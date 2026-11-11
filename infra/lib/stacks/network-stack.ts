/**
 * NetworkStack (sesión 3): la red de CrediFlow como código.
 *
 * Reemplaza el VPC que se creó a mano en la sesión 2. Sin NAT Gateway en dev
 * (costo fijo de ~32 USD/mes); con CF_NAT=true se agregan subredes privadas con salida.
 */
import { Construct } from 'constructs';
import { CrediFlowVpc } from '../constructs';
import { CrediFlowStack, CrediFlowStackProps } from '../crediflow-stack';

export class NetworkStack extends CrediFlowStack {
  public readonly network: CrediFlowVpc;

  constructor(scope: Construct, id: string, props: CrediFlowStackProps) {
    super(scope, id, props);

    this.network = new CrediFlowVpc(this, 'Network', {
      vpcName: this.names.resource('vpc'),
      natGateways: this.cfg.natGateways,
      removalPolicy: this.removalPolicy,
    });

    this.crossStackExport('VpcId', this.network.vpc.vpcId, 'ID del VPC de CrediFlow');
    this.publishParameter('VpcIdParam', 'vpc-id', this.network.vpc.vpcId);
  }
}
