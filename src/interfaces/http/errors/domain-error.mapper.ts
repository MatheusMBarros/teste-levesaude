import type { TriageError } from '../../../application/ports/triage-model.port';
import type { CreateAppointmentError } from '../../../application/use-cases/create-appointment.use-case';
import { assertNever } from '../../../shared/assert-never';
import type { ErrorBody, HttpResponse } from '../http-response';
import { errorResponse } from '../http-response';
import { ERROR_MESSAGES } from './error-messages';

/**
 * Erros de negócio que chegam à camada HTTP como **valor** (`Result`, ADR-002). União fechada:
 * o `switch (error.code)` do mapeamento termina em `assertNever`, então um erro novo aqui não
 * compila até ganhar status e texto. Erros de negócio **lançados** não passam por aqui: são bug
 * e viram 500 no `@HandleHttpErrors`.
 */
export type MappedDomainError = CreateAppointmentError | TriageError;

export function domainErrorResponse(error: MappedDomainError): HttpResponse<ErrorBody> {
  switch (error.code) {
    case 'DOCTOR_NOT_FOUND':
      return errorResponse(404, ERROR_MESSAGES.doctorNotFound);
    case 'SLOT_NOT_OFFERED':
      return errorResponse(422, ERROR_MESSAGES.slotNotOffered);
    case 'SLOT_UNAVAILABLE':
      return errorResponse(409, ERROR_MESSAGES.slotUnavailable);
    // O motivo (`reason`) do 503 fica só no log: o cliente recebe sempre o mesmo corpo.
    case 'TRIAGE_UNAVAILABLE':
      return errorResponse(503, ERROR_MESSAGES.triageUnavailable);
    case 'TRIAGE_INVALID_RESPONSE':
      return errorResponse(502, ERROR_MESSAGES.triageInvalidResponse);
    case 'TRIAGE_TIMEOUT':
      return errorResponse(504, ERROR_MESSAGES.triageTimeout);
    default:
      return assertNever(error);
  }
}
