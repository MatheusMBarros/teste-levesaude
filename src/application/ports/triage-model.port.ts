import type { Specialty } from '../../domain/value-objects/specialty.value-object';
import type { Urgency } from '../../domain/value-objects/urgency.value-object';
import type { Result } from '../../shared/result';
import type { TriageInvalidResponseError } from '../errors/triage-invalid-response.error';
import type { TriageTimeoutError } from '../errors/triage-timeout.error';
import type { TriageUnavailableError } from '../errors/triage-unavailable.error';

/** Falhas esperadas da triagem, devolvidas como valor (ADR-002, ADR-010). */
export type TriageError = TriageUnavailableError | TriageTimeoutError | TriageInvalidResponseError;

export interface TriageRequest {
  /** Relato do paciente já validado na borda (trim, 10 a 2000 caracteres). Nunca vai para log. */
  readonly symptoms: string;
  /** Lista fechada que a resposta tem de respeitar; tupla não vazia por construção. */
  readonly allowedSpecialties: readonly [Specialty, ...Specialty[]];
}

/** Resultado já validado: `specialty` pertence a `allowedSpecialties`. */
export interface TriageClassification {
  readonly specialty: Specialty;
  readonly urgency: Urgency;
  readonly rationale: string;
}

/**
 * Modelo que classifica um relato de sintomas. Implementações: `AnthropicTriageModel` (LLM),
 * `FakeTriageModel` (palavras-chave, determinístico) e `UnavailableTriageModel` (sem chave).
 * Falhas esperadas vêm no `Result`; a Promise só rejeita em falha inesperada (bug).
 */
export interface TriageModel {
  classify(request: TriageRequest): Promise<Result<TriageClassification, TriageError>>;
}
