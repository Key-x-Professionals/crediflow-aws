import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DataStack } from '../lib/stacks/data-stack';
import { testConfig } from './helpers';

describe('DataStack', () => {
  const app = new cdk.App();
  const stack = new DataStack(app, 'Data', { config: testConfig, session: 3 });
  const template = Template.fromStack(stack);

  it('crea la tabla de solicitudes bajo demanda con sus dos índices', () => {
    template.hasResourceProperties('AWS::DynamoDB::GlobalTable', {
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: [
        { IndexName: 'porFecha', KeySchema: [{ AttributeName: 'gsi1pk', KeyType: 'HASH' }, { AttributeName: 'creadaEn', KeyType: 'RANGE' }] },
        { IndexName: 'porEstado', KeySchema: [{ AttributeName: 'estado', KeyType: 'HASH' }, { AttributeName: 'creadaEn', KeyType: 'RANGE' }] },
      ],
    });
  });

  it('no crea bases de datos con costo por hora (RDS) ni secretos', () => {
    template.resourceCountIs('AWS::RDS::DBInstance', 0);
    template.resourceCountIs('AWS::SecretsManager::Secret', 0);
  });

  it('bloquea el acceso público de los buckets', () => {
    template.allResourcesProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });
});
