import { TriageUnavailableError } from '../../application/errors/triage-unavailable.error';
import type {
  TriageClassification,
  TriageError,
  TriageModel,
  TriageRequest,
} from '../../application/ports/triage-model.port';
import type { Result } from '../../shared/result';
import { err } from '../../shared/result';

/**
 * Provider `anthropic` sem `ANTHROPIC_API_KEY` (D17): toda triagem responde 503, e o resto da
 * função (`/agendas`, `/agendamento`) continua funcionando. Não faz chamada de rede.
 */
export class UnavailableTriageModel implements TriageModel {
  classify(_request: TriageRequest): Promise<Result<TriageClassification, TriageError>> {
    return Promise.resolve(err(new TriageUnavailableError('missing_api_key')));
  }
}
