import { DomainError } from '../../domain/errors/domain.error';

/**
 * Por que a triagem ficou indisponível. Só vai para o log: o cliente recebe o mesmo 503 nos três
 * casos (nunca expor detalhe do provedor, `docs/regras/api.md`).
 * - `missing_api_key`: provider `anthropic` sem `ANTHROPIC_API_KEY` (D17);
 * - `provider_unavailable`: 429/5xx/falha de conexão persistentes, ou `retry-after` longo demais;
 * - `provider_rejected`: o provedor recusou a requisição (400/401/403/404/422...), sem retentativa.
 */
export type TriageUnavailableReason =
  'missing_api_key' | 'provider_unavailable' | 'provider_rejected';

/** Triagem indisponível (503). Ver ADR-010. */
export class TriageUnavailableError extends DomainError {
  override readonly code = 'TRIAGE_UNAVAILABLE';

  constructor(readonly reason: TriageUnavailableReason) {
    super(`Triage model unavailable: ${reason}`);
  }
}
