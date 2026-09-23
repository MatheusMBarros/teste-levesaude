import type { APIGatewayProxyResult } from 'aws-lambda';

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

/**
 * Evento de integração proxy REST tratado como **dado externo** na borda: só os campos que o
 * roteador lê. O `@types/aws-lambda` declara `headers` não anulável e `body` não opcional, mas o
 * botão "Test" do console do API Gateway e `serverless invoke` entregam eventos com `headers: null`
 * ou sem `body`. `requestContext`, `httpMethod` e `resource` o API Gateway sempre envia; um evento
 * sem eles não é uma requisição HTTP e fica fora do contrato. Todo `APIGatewayProxyEvent` é
 * atribuível a este tipo (garantido pelo typecheck dos testes, que passam eventos completos), então
 * o handler continua servindo como entrypoint Lambda.
 */
export interface ApiGatewayProxyEventInput {
  readonly httpMethod: string;
  readonly resource: string;
  readonly headers?: Readonly<Record<string, string | undefined>> | null;
  readonly body?: string | null;
  readonly requestContext: { readonly requestId: string };
}

/** Entrypoint Lambda de integração proxy REST. */
export type ApiGatewayHandler = (
  event: ApiGatewayProxyEventInput,
) => Promise<APIGatewayProxyResult>;

function normalizeHeaders(
  headers: ApiGatewayProxyEventInput['headers'],
): Readonly<Record<string, string>> {
  const normalized: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (value !== undefined) {
      normalized[name.toLowerCase()] = value;
    }
  }
  return normalized;
}

export function toHttpRequest(event: ApiGatewayProxyEventInput): HttpRequest {
  return {
    requestId: event.requestContext.requestId,
    method: event.httpMethod,
    resource: event.resource,
    headers: normalizeHeaders(event.headers),
    body: event.body ?? null,
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
    // Rede de segurança: os métodos do controller já tratam erros via `@HandleHttpErrors`, mas uma
    // ação que rejeite (ex.: método novo sem o decorator) não pode virar erro da Lambda, que o
    // gateway devolveria como 502 fora do formato de erro (D9, D19).
    try {
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
    } catch (error: unknown) {
      logger.error('Unhandled error in router', {
        requestId: event.requestContext.requestId,
        method: event.httpMethod,
        resource: event.resource,
        error,
      });
      return toApiGatewayResult(internalErrorResponse());
    }
  };
}
