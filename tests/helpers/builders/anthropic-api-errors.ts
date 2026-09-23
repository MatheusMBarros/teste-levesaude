import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from '@anthropic-ai/sdk';

/*
 * Erros **reais** do SDK `@anthropic-ai/sdk`, construídos como o próprio SDK faz ao receber a
 * resposta HTTP (status, corpo, mensagem, headers). Nada de `jest.mock`: o adapter é exercitado com
 * as mesmas classes que verá em produção.
 */

export const TEST_ANTHROPIC_REQUEST_ID = 'req_test_error_01';

function headers(extra: Readonly<Record<string, string>> = {}): Headers {
  return new Headers({ 'request-id': TEST_ANTHROPIC_REQUEST_ID, ...extra });
}

function body(type: string, message: string): object {
  return { type: 'error', error: { type, message } };
}

export function aTimeoutError(): APIConnectionTimeoutError {
  return new APIConnectionTimeoutError();
}

export function aConnectionError(): APIConnectionError {
  return new APIConnectionError({ message: 'Connection error.', cause: new Error('ECONNRESET') });
}

/**
 * 429. `extraHeaders` entra na resposta como a API envia, ex.: `{ 'retry-after': '1' }` ou
 * `{ 'retry-after-ms': '800' }`.
 */
export function aRateLimitError(
  extraHeaders: Readonly<Record<string, string>> = {},
): RateLimitError {
  return new RateLimitError(
    429,
    body('rate_limit_error', 'Number of requests has exceeded your rate limit'),
    undefined,
    headers(extraHeaders),
  );
}

/** 5xx (`500` interno, `529` sobrecarregado), com headers extras opcionais (`retry-after-ms`). */
export function anInternalServerError(
  status = 500,
  extraHeaders: Readonly<Record<string, string>> = {},
): InternalServerError {
  const type = status === 529 ? 'overloaded_error' : 'api_error';
  return new InternalServerError(
    status,
    body(type, 'Internal server error'),
    undefined,
    headers(extraHeaders),
  );
}

export function anAuthenticationError(): AuthenticationError {
  return new AuthenticationError(
    401,
    body('authentication_error', 'invalid x-api-key'),
    undefined,
    headers(),
  );
}

export function aBadRequestError(): BadRequestError {
  return new BadRequestError(
    400,
    body('invalid_request_error', 'temperature: unsupported value'),
    undefined,
    headers(),
  );
}

export function aPermissionDeniedError(): PermissionDeniedError {
  return new PermissionDeniedError(
    403,
    body('permission_error', 'Permission denied'),
    undefined,
    headers(),
  );
}

export function aNotFoundError(): NotFoundError {
  return new NotFoundError(404, body('not_found_error', 'model: not found'), undefined, headers());
}

export function anUnprocessableEntityError(): UnprocessableEntityError {
  return new UnprocessableEntityError(
    422,
    body('invalid_request_error', 'Unprocessable'),
    undefined,
    headers(),
  );
}
