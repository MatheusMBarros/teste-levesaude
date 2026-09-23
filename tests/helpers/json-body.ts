import type { APIGatewayProxyResult } from 'aws-lambda';

/** Corpo de uma resposta do API Gateway desserializado como `unknown` (sem `any`). */
export function parseJsonBody(result: APIGatewayProxyResult): unknown {
  const parsed: unknown = JSON.parse(result.body);
  return parsed;
}
