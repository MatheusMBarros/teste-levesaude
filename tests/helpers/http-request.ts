import type { HttpRequest } from '../../src/interfaces/http/http-request';

/**
 * `HttpRequest` válido com valores padrão. Cada chamada devolve um objeto **novo**: o corpo
 * validado é associado à instância da requisição (ADR-007).
 */
export function anHttpRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return {
    requestId: 'req-test',
    method: 'POST',
    resource: '/agendamento',
    headers: {},
    body: null,
    ...overrides,
  };
}

/** `HttpRequest` de `POST` com o payload serializado em JSON. */
export function aJsonHttpRequest(
  payload: unknown,
  overrides: Partial<HttpRequest> = {},
): HttpRequest {
  return anHttpRequest({
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    ...overrides,
  });
}
