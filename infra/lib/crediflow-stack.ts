/**
 * CrediFlowStack: clase base de todos los stacks del curso.
 *
 * Qué resuelve por los alumnos:
 *  - Nombra el stack con la convención CrediFlow-<student>-<env>-<Nombre>
 *  - Aplica las etiquetas estándar (Project, Student, Environment, Session)
 *  - Expone `names` y `arns` para construir nombres y ARNs consistentes
 *  - Expone `cfg` con la configuración del .env
 *  - Provee helpers para exports/imports entre stacks (crossStackExport / crossStackImport)
 */
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CrediFlowConfig } from './config';
import { ArnBuilder, NameBuilder } from './naming';

export interface CrediFlowStackProps extends cdk.StackProps {
  readonly config: CrediFlowConfig;
  /** Sesión del curso en la que se introduce el stack (solo para etiquetas) */
  readonly session: number;
}

export class CrediFlowStack extends cdk.Stack {
  public readonly cfg: CrediFlowConfig;
  public readonly names: NameBuilder;
  public readonly arns: ArnBuilder;

  constructor(scope: Construct, id: string, props: CrediFlowStackProps) {
    const names = new NameBuilder(props.config);
    super(scope, id, {
      ...props,
      stackName: props.stackName ?? names.stack(id),
      env: props.env ?? { account: props.config.account, region: props.config.region },
      description: props.description ?? `CrediFlow ${id} (${props.config.student}/${props.config.env}) - sesión ${props.session}`,
      terminationProtection: props.config.isProd,
    });

    this.cfg = props.config;
    this.names = names;
    this.arns = new ArnBuilder(props.config);

    cdk.Tags.of(this).add('Project', props.config.project);
    cdk.Tags.of(this).add('Student', props.config.student);
    cdk.Tags.of(this).add('Environment', props.config.env);
    cdk.Tags.of(this).add('Session', String(props.session));
    cdk.Tags.of(this).add('ManagedBy', 'cdk');
  }

  /** Política de borrado: en dev se destruye todo; en prod se conserva. */
  get removalPolicy(): cdk.RemovalPolicy {
    return this.cfg.isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;
  }

  /** Crea un Output con export name estándar (crediflow-<student>-<env>:<key>) */
  crossStackExport(key: string, value: string, description?: string): cdk.CfnOutput {
    return new cdk.CfnOutput(this, `Out${key}`, {
      value,
      description,
      exportName: this.names.export(key),
    });
  }

  /** Importa un valor exportado por otro stack del mismo alumno */
  crossStackImport(key: string): string {
    return cdk.Fn.importValue(this.names.export(key));
  }

  /** Guarda un valor en SSM Parameter Store para consultarlo desde la CLI */
  publishParameter(id: string, suffix: string, value: string, description?: string): cdk.aws_ssm.StringParameter {
    return new cdk.aws_ssm.StringParameter(this, id, {
      parameterName: this.names.parameter(suffix),
      stringValue: value,
      description,
    });
  }
}
