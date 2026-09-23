import { DomainError } from '../../domain/errors/domain.error';

/**
 * O modelo respondeu fora do formato esperado (502). Ver ADR-010: só é devolvido quando a saída
 * inválida já foi retentada, ou quando o modelo recusou responder (`stop_reason: refusal`, que
 * tende a se repetir e não é retentado).
 */
export class TriageInvalidResponseError extends DomainError {
  override readonly code = 'TRIAGE_INVALID_RESPONSE';

  /** @param invalidOutputs quantas respostas do modelo foram rejeitadas nesta triagem. */
  constructor(readonly invalidOutputs: number) {
    super(`Triage model returned ${String(invalidOutputs)} invalid output(s)`);
  }
}
