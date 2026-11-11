/**
 * SecureBucket: bucket S3 con las buenas prácticas ya aplicadas.
 *
 *  - Bloqueo total de acceso público
 *  - Cifrado en reposo (SSE-S3 o KMS si se pasa una llave)
 *  - Solo HTTPS (enforceSSL)
 *  - Versionado activado
 *  - Regla de ciclo de vida para expirar versiones antiguas
 *  - En dev se puede vaciar y borrar con `cdk destroy`
 */
import * as cdk from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface SecureBucketProps {
  readonly bucketName: string;
  readonly removalPolicy?: cdk.RemovalPolicy;
  /** Llave KMS opcional. Sin ella se usa SSE-S3 (AES-256). */
  readonly encryptionKey?: kms.IKey;
  /** Días para expirar versiones no actuales (por defecto 30) */
  readonly noncurrentVersionExpirationDays?: number;
  /** Bucket para logs de acceso (buena práctica cdk-nag) */
  readonly serverAccessLogsBucket?: s3.IBucket;
}

export class SecureBucket extends Construct {
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: SecureBucketProps) {
    super(scope, id);

    const removalPolicy = props.removalPolicy ?? cdk.RemovalPolicy.RETAIN;

    this.bucket = new s3.Bucket(this, 'Bucket', {
      bucketName: props.bucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: props.encryptionKey ? s3.BucketEncryption.KMS : s3.BucketEncryption.S3_MANAGED,
      encryptionKey: props.encryptionKey,
      enforceSSL: true,
      versioned: true,
      removalPolicy,
      autoDeleteObjects: removalPolicy === cdk.RemovalPolicy.DESTROY,
      serverAccessLogsBucket: props.serverAccessLogsBucket,
      serverAccessLogsPrefix: props.serverAccessLogsBucket ? `${props.bucketName}/` : undefined,
      lifecycleRules: [
        {
          id: 'expire-old-versions',
          noncurrentVersionExpiration: cdk.Duration.days(props.noncurrentVersionExpirationDays ?? 30),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
    });
  }
}
