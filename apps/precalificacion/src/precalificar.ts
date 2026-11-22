/**
 * POST /precalificar  (requiere JWT de Cognito)
 * Body: { ingresoMensual, deudasMensuales, montoSolicitado, plazoMeses }
 */
import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics, MetricUnit } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { json, usuario } from './http';
import { PrecalificacionInputSchema, precalificar } from './motor';

const logger = new Logger();
const metrics = new Metrics();
const tracer = new Tracer();
const ddb = DynamoDBDocumentClient.from(tracer.captureAWSv3Client(new DynamoDBClient({})));
const TABLE = process.env.TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const user = usuario(event);
  logger.appendKeys({ userSub: user.sub });

  let body: unknown;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return json(400, { error: 'JSON inválido' });
  }

  const parsed = PrecalificacionInputSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Datos inválidos', detalles: parsed.error.flatten().fieldErrors });
  }

  const resultado = precalificar(parsed.data);
  const id = randomUUID();
  const creadaEn = new Date().toISOString();

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: `USER#${user.sub}`,
        sk: `PRECAL#${creadaEn}#${id}`,
        id,
        email: user.email,
        ...parsed.data,
        ...resultado,
        creadaEn,
      },
    }),
  );

  metrics.addMetric('Precalificaciones', MetricUnit.Count, 1);
  metrics.addMetric(resultado.elegible ? 'PrecalElegibles' : 'PrecalNoElegibles', MetricUnit.Count, 1);
  metrics.publishStoredMetrics();
  logger.info('Precalificación calculada', { id, elegible: resultado.elegible, dti: resultado.dti });

  return json(200, { id, creadaEn, ...parsed.data, ...resultado });
};
