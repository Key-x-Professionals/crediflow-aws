/**
 * Configuración de CrediFlow por alumno.
 *
 * Todo se lee desde variables de entorno (archivo .env en la raíz del repo),
 * de manera que cada alumno despliega SUS propios recursos sin tocar código.
 *
 * Ejemplo:
 *   CF_STUDENT=edgar-velasco CF_ENV=dev npx cdk deploy
 */
import * as path from 'path';
import * as dotenv from 'dotenv';

// Carga .env de la raíz del monorepo (../.env respecto a infra/)
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

export type Environment = 'dev' | 'prod';

export interface CrediFlowConfig {
  /** Nombre del proyecto. Siempre "crediflow". */
  readonly project: string;
  /** Identificador del alumno, ej. "edgar-velasco". Prefijo de todos los recursos. */
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

/**
 * Normaliza CF_STUDENT a un identificador válido para nombres de recursos:
 * minúsculas, puntos/espacios/símbolos a guion, y recorte a 14 caracteres
 * cortando en el último guion completo (para que el nombre del stack no se pase
 * de largo). "Edgar.Velasco" -> "edgar-velasco"; "maria.jose.perez" -> "maria-jose".
 * Debe producir el MISMO resultado que scripts/mac/load-env.sh.
 */
export function sanitizeStudent(raw: string): string {
  const norm = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!norm) {
    throw new Error(
      `CF_STUDENT="${raw}" no deja ningún carácter válido. Usa tu nombre, ej. "edgar-velasco".`,
    );
  }
  if (norm.length <= 14) return norm;
  const cut = norm.slice(0, 14).replace(/-+$/, '');
  return cut.includes('-') ? cut.replace(/-[^-]*$/, '') : cut;
}

export function loadConfig(): CrediFlowConfig {
  const env = required('CF_ENV', 'dev') as Environment;
  if (env !== 'dev' && env !== 'prod') {
    throw new Error(`CF_ENV debe ser "dev" o "prod" (recibido: ${env})`);
  }
  return {
    project: 'crediflow',
    student: sanitizeStudent(required('CF_STUDENT')),
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
