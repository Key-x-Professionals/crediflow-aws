/**
 * CicdStack (sesión 3): rol para GitHub Actions con OIDC.
 *
 * TODO (laboratorio, parte F2):
 *   1. Crear GithubOidcRole con roleName this.names.role('github-deploy'),
 *      githubRepo this.cfg.githubRepo y existingProviderArn de props
 *   2. Exportar DeployRoleArn
 *
 * Después de desplegarlo, el ARN del rol se guarda como secreto
 * AWS_DEPLOY_ROLE_ARN en el repositorio de GitHub de cada alumno.
 */
import { Construct } from 'constructs';
import { GithubOidcRole } from '../constructs';
import { CrediFlowStack, CrediFlowStackProps } from '../crediflow-stack';

export interface CicdStackProps extends CrediFlowStackProps {
  /** ARN de un proveedor OIDC de GitHub ya existente en la cuenta (opcional) */
  readonly existingProviderArn?: string;
}

export class CicdStack extends CrediFlowStack {
  public readonly deployRole!: GithubOidcRole;

  constructor(scope: Construct, id: string, props: CicdStackProps) {
    super(scope, id, props);

    // TODO: this.deployRole = new GithubOidcRole(this, 'GithubDeploy', { ... });
    // TODO: this.crossStackExport('DeployRoleArn', ...);
  }
}
