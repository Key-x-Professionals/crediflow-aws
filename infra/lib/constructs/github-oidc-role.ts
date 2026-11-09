/**
 * GithubOidcRole: despliegue desde GitHub Actions SIN llaves de acceso.
 *
 *  - Crea (o reutiliza) el proveedor OIDC de GitHub en la cuenta
 *  - Crea un rol que solo puede asumir el repositorio indicado
 *  - El rol puede asumir los roles de CDK bootstrap (cdk-hnb659fds-*-role)
 *    que es lo único que necesita `cdk deploy`
 *
 * Nota: en una cuenta solo puede existir UN proveedor OIDC para
 * token.actions.githubusercontent.com. Si ya existe, pasar `existingProviderArn`.
 */
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface GithubOidcRoleProps {
  readonly roleName: string;
  /** "usuario/repositorio" */
  readonly githubRepo: string;
  /** Ramas permitidas; por defecto cualquier rama y PR del repo */
  readonly allowedRefs?: string[];
  readonly existingProviderArn?: string;
}

export class GithubOidcRole extends Construct {
  public readonly role: iam.Role;
  public readonly providerArn: string;

  constructor(scope: Construct, id: string, props: GithubOidcRoleProps) {
    super(scope, id);

    if (!props.githubRepo || !props.githubRepo.includes('/')) {
      throw new Error('CF_GITHUB_REPO debe tener el formato usuario/repositorio');
    }

    if (props.existingProviderArn) {
      this.providerArn = props.existingProviderArn;
    } else {
      const provider = new iam.OpenIdConnectProvider(this, 'Provider', {
        url: 'https://token.actions.githubusercontent.com',
        clientIds: ['sts.amazonaws.com'],
      });
      this.providerArn = provider.openIdConnectProviderArn;
    }

    const subjects = props.allowedRefs
      ? props.allowedRefs.map((ref) => `repo:${props.githubRepo}:${ref}`)
      : [`repo:${props.githubRepo}:*`];

    this.role = new iam.Role(this, 'Role', {
      roleName: props.roleName,
      description: `Despliegue de CrediFlow desde GitHub Actions (${props.githubRepo})`,
      maxSessionDuration: cdk.Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(this.providerArn, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        StringLike: { 'token.actions.githubusercontent.com:sub': subjects },
      }),
    });

    // Lo único que necesita cdk deploy: asumir los roles del bootstrap
    this.role.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AssumeCdkBootstrapRoles',
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${cdk.Stack.of(this).account}:role/cdk-*`],
      }),
    );
  }
}
