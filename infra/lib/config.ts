/**
 * Configuración de CrediFlow por alumno.
 *
 * Todo se lee desde variables de entorno (archivo .env en la raíz del repo),
 * de manera que cada alumno despliega SUS propios recursos sin tocar código.
 *
 * Ejemplo:
 *   CF_STUDENT=edgar CF_ENV=dev npx cdk deploy
 */
import * as path from 'path';
import * as dotenv from 'dotenv';

// Carga .env de la raíz del monorepo (../.env respecto a infra/)
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

export type Environment = 'dev' | 'prod';

export interface CrediFlowConfig {
  /** Nombre del proyecto. Siempre "crediflow". */
  readonly project: string;
  /** Identificador del alumno, ej. "edgar". Prefijo de todos los recursos. */
  readonly student: string;
  /** Entorno lógico: dev | prod */
  readonly env: Environment;
  /** Cuenta AWS */
  readonly account: string;
  /** Región AWS */
  readonly region: string;
  /** Correo para alertas */
  readonly alertEmail: string;
  /** Repositorio GitHub "usuario/repo" para OIDC */
  readonly githubRepo: string;
  /** CIDR permitido para acceso público en dev */
  readonly allowedCidr: string;
  /** Habilita cdk-nag (sesión 6) */
  readonly nagEnabled: boolean;
  /** NAT Gateways del VPC (0 por defecto: costo casi cero; CF_NAT=true → 1) */
  readonly natGateways: number;
  /** true cuando env === 'prod' */
  readonly isProd: boolean;
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. Copia .env.example a .env y complétala.`,
    );
  }
  return value;
}

function validateStudent(student: string): string {
  if (!/^[a-z][a-z0-9-]{1,11}$/.test(student)) {
    throw new Error(
      `CF_STUDENT="${student}" no es válido. Usa 2-12 caracteres: minúsculas, números y guiones (ej. "maria-p").`,
    );
  }
  return student;
}

export function loadConfig(): CrediFlowConfig {
  const env = required('CF_ENV', 'dev') as Environment;
  if (env !== 'dev' && env !== 'prod') {
    throw new Error(`CF_ENV debe ser "dev" o "prod" (recibido: ${env})`);
  }
  return {
    project: 'crediflow',
    student: validateStudent(required('CF_STUDENT')),
    env,
    account: required('CDK_DEFAULT_ACCOUNT'),
    region: required('CDK_DEFAULT_REGION', 'us-east-1'),
    alertEmail: process.env.CF_ALERT_EMAIL ?? '',
    githubRepo: process.env.CF_GITHUB_REPO ?? '',
    allowedCidr: process.env.CF_ALLOWED_CIDR ?? '0.0.0.0/0',
    nagEnabled: (process.env.CF_NAG ?? 'false').toLowerCase() === 'true',
    natGateways: (process.env.CF_NAT ?? 'false').toLowerCase() === 'true' ? 1 : 0,
    isProd: env === 'prod',
  };
}
