import { CrediFlowConfig } from '../lib/config';
import { ArnBuilder, NameBuilder } from '../lib/naming';

const cfg: CrediFlowConfig = {
  project: 'crediflow',
  student: 'edgar',
  env: 'dev',
  account: '123456789012',
  region: 'us-east-1',
  alertEmail: '',
  githubRepo: '',
  allowedCidr: '0.0.0.0/0',
  nagEnabled: false,
  natGateways: 0,
  isProd: false,
};

describe('NameBuilder', () => {
  const names = new NameBuilder(cfg);

  it('usa el prefijo project-student-env', () => {
    expect(names.prefix).toBe('crediflow-edgar-dev');
    expect(names.resource('api')).toBe('crediflow-edgar-dev-api');
  });

  it('nombra stacks en PascalCase', () => {
    expect(names.stack('Network')).toBe('CrediFlow-edgar-dev-Network');
  });

  it('genera nombres de bucket únicos y en minúsculas', () => {
    expect(names.bucket('Documentos')).toBe('crediflow-edgar-dev-documentos-123456789012-us-east-1');
  });

  it('usa rutas jerárquicas para secretos y parámetros', () => {
    expect(names.secret('db')).toBe('crediflow/edgar/dev/db');
    expect(names.parameter('api-url')).toBe('/crediflow/edgar/dev/api-url');
  });
});

describe('ArnBuilder', () => {
  const arns = new ArnBuilder(cfg);

  it('construye ARNs de DynamoDB y SQS', () => {
    expect(arns.dynamoTable('t')).toBe('arn:aws:dynamodb:us-east-1:123456789012:table/t');
    expect(arns.sqsQueue('q')).toBe('arn:aws:sqs:us-east-1:123456789012:q');
  });

  it('agrega el sufijo aleatorio de Secrets Manager', () => {
    expect(arns.secret('crediflow/edgar/dev/db')).toBe('arn:aws:secretsmanager:us-east-1:123456789012:secret:crediflow/edgar/dev/db-*');
  });
});
