import { internalErrorResponse } from '../errors/error-responses';
import type { HttpRequest } from '../http-request';
import type { ErrorAwareMethod, WithLogger } from './controller-method';

/**
 * Converte qualquer falha **lançada** (bug, infraestrutura) em 500 genérico, sem vazar mensagem
 * nem stack, e registra a causa com o local (`Classe.método`). Erros de negócio não passam por
 * aqui: chegam como `Result` e são mapeados pelo controller (ADR-007).
 */
export function HandleHttpErrors<This extends WithLogger, TSuccess>(
  method: ErrorAwareMethod<This, TSuccess>,
  context: ClassMethodDecoratorContext<This, ErrorAwareMethod<This, TSuccess>>,
): ErrorAwareMethod<This, TSuccess> {
  const methodName = String(context.name);

  return async function errorHandlingMethod(this: This, request: HttpRequest) {
    try {
      return await method.call(this, request);
    } catch (error: unknown) {
      this.logger.error('Unhandled error while handling request', {
        location: `${this.constructor.name}.${methodName}`,
        requestId: request.requestId,
        method: request.method,
        resource: request.resource,
        error,
      });
      return internalErrorResponse();
    }
  };
}
