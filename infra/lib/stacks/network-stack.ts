/**
 * NetworkStack (sesión 3): la red de CrediFlow como código.
 *
 * Reemplaza el VPC que se creó a mano en la sesión 2.
 *
 * TODO (laboratorio, parte B):
 *   1. Crear la red con el construct CrediFlowVpc (vpcName con this.names, NAT HA solo en prod)
 *   2. Exportar el VpcId con crossStackExport
 *   3. Publicar el VpcId en SSM con publishParameter ('vpc-id')
 */
import { Construct } from 'constructs';
import { CrediFlowVpc } from '../constructs';
import { CrediFlowStack, CrediFlowStackProps } from '../crediflow-stack';

export class NetworkStack extends CrediFlowStack {
  public readonly network!: CrediFlowVpc;

  constructor(scope: Construct, id: string, props: CrediFlowStackProps) {
    super(scope, id, props);

    // TODO: this.network = new CrediFlowVpc(this, 'Network', { ... });
    // TODO: this.crossStackExport('VpcId', ...);
    // TODO: this.publishParameter('VpcIdParam', 'vpc-id', ...);
  }
}
