import type { Logger } from '../../../application/ports/logger.port';
import type { HttpRequest } from '../http-request';
import type { ErrorBody, HttpResponse } from '../http-response';

/**
 * Forma de um método de controller decorável. `TBody` é o corpo de **todas** as respostas
 * possíveis do método: como os decorators podem responder erro (400/500) e um decorator TS 5 não
 * muda o tipo do método, o compilador exige que o método declare `Sucesso | ErrorBody`.
 * Ver ADR-007.
 */
export type ControllerMethod<This, TBody> = (
  this: This,
  request: HttpRequest,
) => Promise<HttpResponse<TBody>>;

/**
 * Método que pode responder com `TSuccess` ou com o corpo de erro padrão. Todo decorator de
 * controller (padrão TC39/TS 5, sem `experimentalDecorators`) recebe e devolve este tipo, com
 * `ClassMethodDecoratorContext<This, ErrorAwareMethod<This, TSuccess>>`: o substituto tem a
 * **mesma** assinatura do original.
 */
export type ErrorAwareMethod<This, TSuccess> = ControllerMethod<This, TSuccess | ErrorBody>;

/**
 * Controllers que usam `@LogRequest`/`@HandleHttpErrors` expõem o `Logger` injetado. Decorators
 * são avaliados na definição da classe, antes de existir o container; ler `this.logger` na
 * chamada mantém a injeção por construtor (ADR-007).
 */
export interface WithLogger {
  readonly logger: Logger;
}
