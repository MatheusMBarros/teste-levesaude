import type { ErrorBody, ErrorDetail, HttpResponse } from '../http-response';
import { errorResponse } from '../http-response';
import { ERROR_MESSAGES } from './error-messages';

/** 400 do contrato (D8): sempre com `detalhes` apontando o campo. */
export function invalidPayloadResponse(
  details: ReadonlyArray<ErrorDetail>,
): HttpResponse<ErrorBody> {
  return errorResponse(400, { ...ERROR_MESSAGES.invalidPayload, detalhes: details });
}

/** 500 genérico (D9): nunca carrega detalhe da falha. */
export function internalErrorResponse(): HttpResponse<ErrorBody> {
  return errorResponse(500, ERROR_MESSAGES.internalError);
}
