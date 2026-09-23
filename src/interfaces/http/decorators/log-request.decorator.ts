import type { HttpRequest } from '../http-request';
import type { ErrorAwareMethod, WithLogger } from './controller-method';

/** Uma linha `info` por requisição com status e duração; fica por fora para medir tudo (ADR-007). */
export function LogRequest<This extends WithLogger, TSuccess>(
  method: ErrorAwareMethod<This, TSuccess>,
  _context: ClassMethodDecoratorContext<This, ErrorAwareMethod<This, TSuccess>>,
): ErrorAwareMethod<This, TSuccess> {
  return async function loggingMethod(this: This, request: HttpRequest) {
    const startedAt = performance.now();
    const response = await method.call(this, request);
    this.logger.info('Request completed', {
      requestId: request.requestId,
      method: request.method,
      resource: request.resource,
      statusCode: response.statusCode,
      durationMs: performance.now() - startedAt,
    });
    return response;
  };
}
