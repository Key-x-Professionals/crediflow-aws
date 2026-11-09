/**
 * GET /precalificaciones  (requiere JWT de Cognito)
 * Devuelve las últimas precalificaciones del usuario autenticado.
 */
import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { json, usuario } from './http';

const logger = new Logger();
const tracer = new Tracer();
const ddb = DynamoDBDocumentClient.from(tracer.captureAWSv3Client(new DynamoDBClient({})));
const TABLE = process.env.TABLE_NAME!;

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const user = usuario(event);
  const { Items = [] } = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
      ExpressionAttributeValues: { ':pk': `USER#${user.sub}`, ':sk': 'PRECAL#' },
      ScanIndexForward: false,
      Limit: 20,
    }),
  );
  logger.info('Consulta de precalificaciones', { userSub: user.sub, total: Items.length });
  return json(200, Items.map(({ pk: _pk, sk: _sk, ...rest }) => rest));
};
