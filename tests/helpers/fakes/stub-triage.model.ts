import type {
  TriageClassification,
  TriageError,
  TriageModel,
  TriageRequest,
} from '../../../src/application/ports/triage-model.port';
import type { Result } from '../../../src/shared/result';
import { err, ok } from '../../../src/shared/result';

const DEFAULT_CLASSIFICATION: TriageClassification = {
  specialty: 'Cardiologista',
  urgency: 'media',
  rationale: 'Dor no peito aos esforços e palpitações sugerem avaliação cardiológica.',
};

/** Classificação válida da porta `TriageModel`; os campos passados substituem os padrões. */
export function aTriageClassification(
  overrides: Partial<TriageClassification> = {},
): TriageClassification {
  return { ...DEFAULT_CLASSIFICATION, ...overrides };
}

/**
 * Stub da porta `TriageModel`: devolve sempre o mesmo resultado e registra as requisições
 * recebidas. Substitui o LLM nos testes do caso de uso e da integração (sem rede).
 * Uso: `StubTriageModel.returning(aTriageClassification())` ou
 * `StubTriageModel.failingWith(new TriageTimeoutError(5_000))`.
 */
export class StubTriageModel implements TriageModel {
  private readonly receivedRequests: TriageRequest[] = [];

  private constructor(private readonly outcome: Result<TriageClassification, TriageError>) {}

  static returning(
    classification: TriageClassification = aTriageClassification(),
  ): StubTriageModel {
    return new StubTriageModel(ok(classification));
  }

  static failingWith(error: TriageError): StubTriageModel {
    return new StubTriageModel(err(error));
  }

  get requests(): ReadonlyArray<TriageRequest> {
    return this.receivedRequests;
  }

  classify(request: TriageRequest): Promise<Result<TriageClassification, TriageError>> {
    this.receivedRequests.push(request);
    return Promise.resolve(this.outcome);
  }
}
