import { DomainError } from '../../domain/errors/domain.error';

/** A chamada ao modelo passou do tempo por tentativa (504, sem retentativa). Ver ADR-010. */
export class TriageTimeoutError extends DomainError {
  override readonly code = 'TRIAGE_TIMEOUT';

  constructor(readonly timeoutMs: number) {
    super(`Triage model did not answer within ${String(timeoutMs)} ms`);
  }
}
