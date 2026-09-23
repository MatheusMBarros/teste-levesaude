/**
 * Headers de **toda** resposta produzida pela Lambda, inclusive erros (D19): o `cors: true` do
 * evento `http` só cria o preflight `OPTIONS`; em integração proxy o header de CORS precisa vir
 * da própria função.
 */
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
} as const;

export type HttpHeaders = Readonly<Record<string, string>>;

/**
 * Resposta HTTP com corpo tipado; `router.ts` a serializa para o API Gateway. Construída apenas
 * pelos helpers deste módulo, que sempre aplicam `DEFAULT_HEADERS`.
 */
export interface HttpResponse<TBody> {
  readonly statusCode: number;
  readonly headers: HttpHeaders;
  readonly body: TBody;
}

/** Item de `detalhes` no contrato de erro (chaves do contrato, D9). */
export interface ErrorDetail {
  readonly campo: string;
  readonly problema: string;
}

/** Corpo de erro do contrato: sempre `{ erro, mensagem, detalhes? }` (D9). */
export interface ErrorBody {
  readonly erro: string;
  readonly mensagem: string;
  readonly detalhes?: ReadonlyArray<ErrorDetail>;
}

export function jsonResponse<TBody>(statusCode: number, body: TBody): HttpResponse<TBody> {
  return { statusCode, headers: DEFAULT_HEADERS, body };
}

export function okResponse<TBody>(body: TBody): HttpResponse<TBody> {
  return jsonResponse(200, body);
}

export function createdResponse<TBody>(body: TBody): HttpResponse<TBody> {
  return jsonResponse(201, body);
}

export function errorResponse(statusCode: number, body: ErrorBody): HttpResponse<ErrorBody> {
  return jsonResponse(statusCode, body);
}
