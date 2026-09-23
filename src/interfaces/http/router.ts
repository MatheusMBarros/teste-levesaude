import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventHeaders,
  APIGatewayProxyResult,
} from 'aws-lambda';

import type { Logger } from '../../application/ports/logger.port';
import { internalErrorResponse } from './errors/error-responses';
import type { HttpRequest } from './http-request';
import type { HttpResponse } from './http-response';

/** Chave da tabela de rotas: `"<MÉTODO> <resource>"`, ex.: `"POST /agendamento"` (D15). */
export type RouteKey = `${'GET' | 'POST'} /${string}`;

/** Ação de uma rota: normalmente uma arrow que delega a um método decorado do controller. */
export type RouteAction = (request: HttpRequest) => Promise<HttpResponse<unknown>>;

/**
 * Tabela declarativa `resource + httpMethod` → ação. É toda a "lógica" de um handler com mais
 * de uma rota: sem `if`/`switch` de negócio. Rota ausente é erro de configuração (500).
 */
export type RouteTable = Readonly<Partial<Record<RouteKey, RouteAction>>>;

/** Entrypoint Lambda de integração proxy REST. */
export type ApiGatewayHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

function normalizeHeaders(headers: APIGatewayProxyEventHeaders): Readonly<Record<string, string>> {
  const normalized: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined) {
      normalized[name.toLowerCase()] = value;
    }
  }
  return normalized;
}

export function toHttpRequest(event: APIGatewayProxyEvent): HttpRequest {
  return {
    requestId: event.requestContext.requestId,
    method: event.httpMethod,
    resource: event.resource,
    headers: normalizeHeaders(event.headers),
    body: event.body,
  };
}

export function toApiGatewayResult(response: HttpResponse<unknown>): APIGatewayProxyResult {
  return {
    statusCode: response.statusCode,
    headers: { ...response.headers },
    body: JSON.stringify(response.body),
  };
}

export function createRouter(routes: RouteTable, logger: Logger): ApiGatewayHandler {
  // Map indexado por string: a chave vem do evento e não é um `RouteKey` em tempo de compilação.
  const actions = new Map(Object.entries(routes));

  return async (event) => {
    const request = toHttpRequest(event);
    const action = actions.get(`${request.method} ${request.resource}`);
    if (action === undefined) {
      logger.error('No route configured for request', {
        requestId: request.requestId,
        method: request.method,
        resource: request.resource,
      });
      return toApiGatewayResult(internalErrorResponse());
    }
    return toApiGatewayResult(await action(request));
  };
}
