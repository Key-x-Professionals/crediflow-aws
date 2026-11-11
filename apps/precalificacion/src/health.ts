import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { json } from './http';

export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> =>
  json(200, { status: 'ok', service: 'crediflow-precalificacion', region: process.env.AWS_REGION });
