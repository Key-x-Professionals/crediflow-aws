#!/usr/bin/env node
/**
 * Sesión 1 · Tercera forma de interactuar con AWS: el SDK.
 *
 *   node scripts/sdk/quien-soy.js
 *
 * Usa las mismas credenciales que la CLI (perfil de `aws login` indicado en AWS_PROFILE).
 */
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

async function main() {
  const region = process.env.AWS_REGION ?? process.env.CDK_DEFAULT_REGION ?? 'us-east-1';
  const sts = new STSClient({ region });
  const s3 = new S3Client({ region });

  const who = await sts.send(new GetCallerIdentityCommand({}));
  console.log('Cuenta  :', who.Account);
  console.log('Identidad:', who.Arn);

  try {
    const { Buckets = [] } = await s3.send(new ListBucketsCommand({}));
    console.log(`Buckets visibles: ${Buckets.length}`);
    for (const b of Buckets.slice(0, 10)) console.log('  -', b.Name);
  } catch (err) {
    // Aquí se aprende a leer un AccessDenied: qué acción, qué recurso y qué identidad
    console.log('No se pudieron listar los buckets:', err.name, '-', err.message);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
