import { CrediFlowConfig } from '../lib/config';

export const testConfig: CrediFlowConfig = {
  project: 'crediflow',
  student: 'test',
  env: 'dev',
  account: '123456789012',
  region: 'us-east-1',
  alertEmail: '',
  githubRepo: 'test/crediflow',
  allowedCidr: '0.0.0.0/0',
  nagEnabled: false,
  natGateways: 0,
  isProd: false,
};
