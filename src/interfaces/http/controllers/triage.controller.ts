import type { Logger } from '../../../application/ports/logger.port';
import type { TriageError } from '../../../application/ports/triage-model.port';
import type {
  SpecialtySuggestion,
  SuggestSpecialtyInput,
} from '../../../application/use-cases/suggest-specialty.use-case';
import type { UseCase } from '../../../application/use-cases/use-case';
import type { Result } from '../../../shared/result';
import type { WithLogger } from '../decorators/controller-method';
import { HandleHttpErrors } from '../decorators/handle-http-errors.decorator';
import { LogRequest } from '../decorators/log-request.decorator';
import { ValidateBody } from '../decorators/validate-body.decorator';
import { domainErrorResponse } from '../errors/domain-error.mapper';
import type { HttpRequest } from '../http-request';
import type { ErrorBody, HttpResponse } from '../http-response';
import { okResponse } from '../http-response';
import type { TriageResponseBody } from '../presenters/triage.presenter';
import { presentTriage } from '../presenters/triage.presenter';
import { triageBody } from '../schemas/triage.schema';

type SuggestSpecialty = UseCase<SuggestSpecialtyInput, Result<SpecialtySuggestion, TriageError>>;

/** `POST /triagem` (contrato 3). Na função `schedule` para ler a mesma agenda (D15, ADR-009). */
export class TriageController implements WithLogger {
  constructor(
    private readonly suggestSpecialtyUseCase: SuggestSpecialty,
    readonly logger: Logger,
  ) {}

  @LogRequest
  @HandleHttpErrors
  @ValidateBody(triageBody)
  async suggestSpecialty(
    request: HttpRequest,
  ): Promise<HttpResponse<TriageResponseBody | ErrorBody>> {
    const { sintomas } = triageBody.of(request);
    const result = await this.suggestSpecialtyUseCase.execute({ symptoms: sintomas });
    if (!result.ok) {
      return domainErrorResponse(result.error);
    }
    return okResponse(presentTriage(result.value));
  }
}
