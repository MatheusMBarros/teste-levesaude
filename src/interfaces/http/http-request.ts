/**
 * Requisição HTTP como os controllers a enxergam, independente do evento do API Gateway
 * (a conversão fica em `router.ts`). O corpo chega **bruto**: quem o valida e o entrega tipado
 * é o `@ValidateBody` (ADR-007). Por isso não há `HttpRequest<TBody>`: um decorator TS 5 não
 * altera o tipo do método, e um corpo tipado aqui exigiria `as` no roteador.
 *
 * Os decorators repassam **o mesmo objeto** ao método decorado (nunca uma cópia): o corpo
 * validado é associado à instância da requisição.
 */
export interface HttpRequest {
  /** `requestContext.requestId` do API Gateway; correlaciona as linhas de log. */
  readonly requestId: string;
  /** Método HTTP em maiúsculas (`GET`, `POST`). */
  readonly method: string;
  /** Rota declarada no API Gateway (`/agendas`), não o path concreto. Chave do roteamento (D15). */
  readonly resource: string;
  /** Headers com nomes em minúsculas (HTTP é case-insensitive); valores ausentes são omitidos. */
  readonly headers: Readonly<Record<string, string>>;
  /** Corpo como veio do API Gateway: texto ou `null` quando ausente. */
  readonly body: string | null;
}
