import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

export function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

/** Identidad del usuario autenticado por Cognito (claims del JWT validados por API Gateway) */
export function usuario(event: APIGatewayProxyEvent): { sub: string; email: string } {
  const claims = (event.requestContext.authorizer?.claims ?? {}) as Record<string, string>;
  return { sub: claims.sub ?? 'anonimo', email: claims.email ?? '' };
}
