import type { Anthropic } from '@anthropic-ai/sdk';
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  InternalServerError,
  RateLimitError,
} from '@anthropic-ai/sdk';

import { TriageInvalidResponseError } from '../../application/errors/triage-invalid-response.error';
import { TriageTimeoutError } from '../../application/errors/triage-timeout.error';
import { TriageUnavailableError } from '../../application/errors/triage-unavailable.error';
import type { LogContext, Logger } from '../../application/ports/logger.port';
import type {
  TriageClassification,
  TriageError,
  TriageModel,
  TriageRequest,
} from '../../application/ports/triage-model.port';
import type { Result } from '../../shared/result';
import { err, ok } from '../../shared/result';
import {
  TRIAGE_PROMPT_VERSION,
  TRIAGE_TOOL_NAME,
  system,
  triageTool,
  userMessage,
} from './prompts/triage.prompt.v1';
import { triageOutputSchema } from './triage-output.schema';

/*
 * Orçamento de tempo (ADR-010). A função Lambda tem 20 s; o pior caso aqui é
 * MAX_ATTEMPTS × ATTEMPT_TIMEOUT_MS + Σ max(BACKOFF_MS[i], MAX_RETRY_AFTER_MS): cada pausa é o
 * backoff com jitter (no máximo ×1) ou o `retry-after` do provedor (no máximo MAX_RETRY_AFTER_MS),
 * o que for maior. Com os valores abaixo: 3 × 5 s + max(0,5 s; 1 s) + max(1 s; 1 s) = 17 s,
 * deixando 3 s de margem para a Lambda (inclui a leitura do corpo, que o timeout do SDK não cobre).
 * Há teste de fórmula e de comportamento para esse teto. Ajustar após medir a latência real.
 */

/** Tempo máximo de cada chamada ao provedor; estourou, 504 sem nova tentativa. */
export const ATTEMPT_TIMEOUT_MS = 5_000;

/** Total de chamadas por triagem, somando retentativas por falha transitória e por saída inválida. */
export const MAX_ATTEMPTS = 3;

/** Pausa antes da 2ª e da 3ª tentativa após falha transitória (sofre jitter de 75% a 100%). */
export const BACKOFF_MS = [500, 1_000] as const;

/** `retry-after` acima disto não é esperado: responde 503 na hora, sem estourar o orçamento. */
export const MAX_RETRY_AFTER_MS = 1_000;

/** Retentativas quando o modelo responde fora do formato (esgotadas, 502). */
export const MAX_INVALID_OUTPUT_RETRIES = 1;

const PROVIDER = 'anthropic';
const MAX_TOKENS = 400;
const JITTER_FLOOR = 0.75;

type CreateMessageParams = Anthropic.MessageCreateParamsNonStreaming;

/** Resposta de `messages.create` como o SDK a entrega (`Message` + `_request_id`). */
export type AnthropicResponseMessage = Anthropic.Message & {
  readonly _request_id?: string | null;
};

/**
 * Fatia do cliente do SDK que o adapter usa. A instância real (`new Anthropic(...)`) é atribuível a
 * esta interface sem `as`; os testes injetam um stub tipado (nenhuma chamada de rede).
 */
export interface AnthropicMessagesClient {
  readonly messages: {
    create(
      params: CreateMessageParams,
      options?: Anthropic.RequestOptions,
    ): Promise<AnthropicResponseMessage>;
  };
}

export interface AnthropicTriageModelOptions {
  /** Id do modelo (`TRIAGE_MODEL`). */
  readonly model: string;
  /** Pausa entre tentativas; injetável para testes sem espera real. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Fonte de aleatoriedade do jitter, em [0, 1). */
  readonly random?: () => number;
  /** Relógio em milissegundos desde a época (latência e `retry-after` em formato de data). */
  readonly now?: () => number;
}

/** Desfecho de uma tentativa, já classificado. Só metadados: nunca sintomas nem saída do modelo. */
type AttemptOutcome =
  | { readonly kind: 'success'; readonly classification: TriageClassification }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'transient'; readonly retryAfterMs: number | undefined }
  | { readonly kind: 'rejected' }
  | { readonly kind: 'refusal' }
  | { readonly kind: 'invalid_output' };

type OutputCheck =
  | { readonly valid: true; readonly classification: TriageClassification }
  | { readonly valid: false; readonly refusal: boolean; readonly context: LogContext };

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** `retry-after-ms` (ms) tem precedência; `retry-after` vem em segundos ou como data HTTP. */
function retryAfterMs(headers: Headers | undefined, now: number): number | undefined {
  const milliseconds = Number.parseFloat(headers?.get('retry-after-ms') ?? '');
  if (Number.isFinite(milliseconds)) {
    return Math.max(0, milliseconds);
  }
  const value = headers?.get('retry-after');
  if (value === null || value === undefined) {
    return undefined;
  }
  const seconds = Number.parseFloat(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000);
  }
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

/**
 * Valida a resposta: parou normalmente, trouxe o bloco `tool_use` da ferramenta de triagem e a
 * entrada passa no Zod montado com as especialidades desta requisição. Em falha, o contexto de log
 * tem só o motivo e, do Zod, `path` e `code` das issues: nunca os valores (poderiam repetir o
 * relato).
 */
function checkOutput(message: AnthropicResponseMessage, request: TriageRequest): OutputCheck {
  if (message.stop_reason === 'refusal') {
    return { valid: false, refusal: true, context: { invalidReason: 'refusal' } };
  }
  if (message.stop_reason === 'max_tokens') {
    return { valid: false, refusal: false, context: { invalidReason: 'stop_reason' } };
  }
  const toolUse = message.content.find(
    (block) => block.type === 'tool_use' && block.name === TRIAGE_TOOL_NAME,
  );
  if (toolUse?.type !== 'tool_use') {
    return { valid: false, refusal: false, context: { invalidReason: 'missing_tool_use' } };
  }
  const parsed = triageOutputSchema(request.allowedSpecialties).safeParse(toolUse.input);
  if (!parsed.success) {
    return {
      valid: false,
      refusal: false,
      context: {
        invalidReason: 'schema_mismatch',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          code: issue.code,
        })),
      },
    };
  }
  return { valid: true, classification: parsed.data };
}

/**
 * Adapter da porta `TriageModel` sobre a Messages API: **só** a chamada ao modelo, a classificação
 * das falhas e as retentativas. Regras de negócio (agenda, aviso, emergência) ficam no caso de uso.
 *
 * Política de falhas (ADR-010), sempre com no máximo `MAX_ATTEMPTS` chamadas:
 * - timeout do cliente em qualquer tentativa → `TriageTimeoutError` (504) na hora, sem retentar;
 * - 429, 5xx e falha de conexão → retenta com backoff; `retry-after` maior que
 *   `MAX_RETRY_AFTER_MS` → `TriageUnavailableError('provider_unavailable')` (503) na hora;
 * - outro erro da API (400, 401, 403, 404, 422...) → `provider_rejected` (503), sem retentar;
 * - saída fora do formato → `MAX_INVALID_OUTPUT_RETRIES` retentativa(s); só quando a saída
 *   inválida **já foi retentada** e voltou inválida → `TriageInvalidResponseError` (502);
 * - `stop_reason: refusal` → 502 na hora (uma recusa tende a se repetir);
 * - orçamento de tentativas esgotado por qualquer outro motivo, inclusive [429, 429, inválida] →
 *   `provider_unavailable` (503): o limite foi consumido pelas falhas do provedor;
 * - erro que não vem do SDK → relançado (bug; vira 500 no `@HandleHttpErrors`).
 *
 * A retentativa é nossa: o cliente deve ser criado com `maxRetries: 0`, e cada chamada também
 * passa `maxRetries: 0` e o `timeout` por tentativa.
 *
 * Logs: provider, modelo, versão do prompt, tentativa, latência, tipo de erro, status HTTP,
 * `stop_reason`, tokens e request-id da Anthropic. Nunca sintomas, chave, saída do modelo nem o
 * objeto de erro do SDK (a mensagem dele pode ecoar dados da requisição).
 */
export class AnthropicTriageModel implements TriageModel {
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly random: () => number;
  private readonly now: () => number;

  constructor(
    private readonly client: AnthropicMessagesClient,
    private readonly logger: Logger,
    private readonly options: AnthropicTriageModelOptions,
  ) {
    this.sleep = options.sleep ?? defaultSleep;
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
  }

  async classify(request: TriageRequest): Promise<Result<TriageClassification, TriageError>> {
    const params: CreateMessageParams = {
      model: this.options.model,
      max_tokens: MAX_TOKENS,
      system: system(request.allowedSpecialties),
      tools: [triageTool(request.allowedSpecialties)],
      tool_choice: { type: 'tool', name: TRIAGE_TOOL_NAME, disable_parallel_tool_use: true },
      messages: [{ role: 'user', content: userMessage(request.symptoms) }],
    };

    let invalidOutputs = 0;
    for (let attempt = 1; ; attempt += 1) {
      const outcome = await this.attempt(params, request, attempt);
      const canRetry = attempt < MAX_ATTEMPTS;

      switch (outcome.kind) {
        case 'success':
          return this.finish(attempt, ok(outcome.classification));
        case 'timeout':
          return this.finish(attempt, err(new TriageTimeoutError(ATTEMPT_TIMEOUT_MS)));
        case 'rejected':
          return this.finish(attempt, err(new TriageUnavailableError('provider_rejected')));
        case 'refusal':
          invalidOutputs += 1;
          return this.finish(attempt, err(new TriageInvalidResponseError(invalidOutputs)));
        case 'invalid_output':
          invalidOutputs += 1;
          if (invalidOutputs > MAX_INVALID_OUTPUT_RETRIES) {
            return this.finish(attempt, err(new TriageInvalidResponseError(invalidOutputs)));
          }
          if (!canRetry) {
            // A saída inválida ainda tinha direito a retentativa: quem gastou o orçamento foram
            // as falhas do provedor (ex.: [429, 429, inválida]). ADR-010.
            return this.finish(attempt, err(new TriageUnavailableError('provider_unavailable')));
          }
          break;
        case 'transient': {
          const delayMs = this.retryDelay(attempt, outcome.retryAfterMs);
          if (!canRetry || delayMs === undefined) {
            return this.finish(attempt, err(new TriageUnavailableError('provider_unavailable')));
          }
          await this.sleep(delayMs);
          break;
        }
      }
    }
  }

  private async attempt(
    params: CreateMessageParams,
    request: TriageRequest,
    attempt: number,
  ): Promise<AttemptOutcome> {
    const startedAt = this.now();
    const base = (): LogContext => ({
      ...this.logBase(),
      attempt,
      latencyMs: this.now() - startedAt,
    });

    let message: AnthropicResponseMessage;
    try {
      message = await this.client.messages.create(params, {
        timeout: ATTEMPT_TIMEOUT_MS,
        maxRetries: 0,
      });
    } catch (error: unknown) {
      return this.classifyFailure(error, base());
    }

    const response: LogContext = {
      stopReason: message.stop_reason,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      anthropicRequestId: message._request_id ?? null,
    };
    const output = checkOutput(message, request);
    if (!output.valid) {
      this.logger.warn('Triage attempt failed', {
        ...base(),
        ...response,
        errorKind: output.refusal ? 'refusal' : 'invalid_output',
        ...output.context,
      });
      return { kind: output.refusal ? 'refusal' : 'invalid_output' };
    }
    this.logger.info('Triage attempt succeeded', { ...base(), ...response });
    return { kind: 'success', classification: output.classification };
  }

  /** Do mais específico ao mais geral: `APIConnectionTimeoutError` estende `APIConnectionError`. */
  private classifyFailure(error: unknown, context: LogContext): AttemptOutcome {
    if (error instanceof APIConnectionTimeoutError) {
      this.logFailure(context, 'timeout');
      return { kind: 'timeout' };
    }
    if (error instanceof APIConnectionError) {
      this.logFailure(context, 'connection_error');
      return { kind: 'transient', retryAfterMs: undefined };
    }
    if (error instanceof RateLimitError || error instanceof InternalServerError) {
      this.logFailure(
        context,
        error instanceof RateLimitError ? 'rate_limited' : 'server_error',
        error,
      );
      return { kind: 'transient', retryAfterMs: retryAfterMs(error.headers, this.now()) };
    }
    if (error instanceof APIError) {
      this.logFailure(context, 'rejected', error);
      return { kind: 'rejected' };
    }
    this.logger.error('Triage attempt failed with an unexpected error', {
      ...context,
      errorKind: 'unexpected',
    });
    throw error;
  }

  private logFailure(context: LogContext, errorKind: string, error?: APIError): void {
    this.logger.warn('Triage attempt failed', {
      ...context,
      errorKind,
      ...(error === undefined
        ? {}
        : {
            status: error.status ?? null,
            errorType: error.type,
            anthropicRequestId: error.requestID ?? null,
          }),
    });
  }

  /** Backoff com jitter ou `retry-after`, o maior; `undefined` quando o provedor pede mais que o teto. */
  private retryDelay(attempt: number, retryAfter: number | undefined): number | undefined {
    if (retryAfter !== undefined && retryAfter > MAX_RETRY_AFTER_MS) {
      return undefined;
    }
    // Só chega aqui com attempt < MAX_ATTEMPTS, e BACKOFF_MS tem MAX_ATTEMPTS - 1 itens (há teste).
    const backoff = BACKOFF_MS[attempt - 1] ?? Math.max(...BACKOFF_MS);
    const jittered = backoff * (JITTER_FLOOR + (1 - JITTER_FLOOR) * this.random());
    return Math.max(jittered, retryAfter ?? 0);
  }

  private finish(
    attempts: number,
    result: Result<TriageClassification, TriageError>,
  ): Result<TriageClassification, TriageError> {
    const context = { ...this.logBase(), attempts };
    if (result.ok) {
      this.logger.info('Triage completed', context);
    } else {
      const { error } = result;
      const reason = error instanceof TriageUnavailableError ? { reason: error.reason } : {};
      this.logger.warn('Triage failed', { ...context, code: error.code, ...reason });
    }
    return result;
  }

  private logBase(): LogContext {
    return { provider: PROVIDER, model: this.options.model, promptVersion: TRIAGE_PROMPT_VERSION };
  }
}
