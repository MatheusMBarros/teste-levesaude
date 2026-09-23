import type { AnthropicMessagesClient } from '../../../src/infrastructure/llm/anthropic-triage.model';
import type { AnthropicMessage } from '../builders/anthropic-message';

type CreateMessage = AnthropicMessagesClient['messages']['create'];

export type CreateMessageParams = Parameters<CreateMessage>[0];
export type CreateMessageOptions = Parameters<CreateMessage>[1];

/** Uma chamada recebida por `messages.create`, na ordem. */
export interface CreateMessageCall {
  readonly params: CreateMessageParams;
  readonly options: CreateMessageOptions;
}

/** Resposta roteirizada: uma mensagem (resolve) ou um erro (rejeita, como o SDK faz). */
export type StubOutcome = AnthropicMessage | Error;

/**
 * Stub tipado da interface estreita `AnthropicMessagesClient` (nenhuma chamada de rede). Cada
 * chamada consome a próxima resposta do roteiro; chamada além do roteiro rejeita com erro de teste,
 * o que denuncia retentativas a mais.
 * Uso: `new StubAnthropicMessagesClient(aRateLimitError(), aToolUseMessage(aTriageToolInput()))`.
 */
export class StubAnthropicMessagesClient implements AnthropicMessagesClient {
  private readonly receivedCalls: CreateMessageCall[] = [];
  private readonly script: StubOutcome[];

  constructor(...outcomes: ReadonlyArray<StubOutcome>) {
    this.script = [...outcomes];
  }

  get calls(): ReadonlyArray<CreateMessageCall> {
    return this.receivedCalls;
  }

  /** Parâmetros da primeira chamada; falha o teste se não houve chamada. */
  get firstCall(): CreateMessageCall {
    const [first] = this.receivedCalls;
    if (first === undefined) {
      throw new Error('messages.create não foi chamado');
    }
    return first;
  }

  readonly messages = {
    create: (
      params: CreateMessageParams,
      options?: CreateMessageOptions,
    ): Promise<AnthropicMessage> => {
      this.receivedCalls.push({ params, options });
      const outcome = this.script.shift();
      if (outcome === undefined) {
        return Promise.reject(
          new Error(
            `Stub sem resposta roteirizada para a chamada ${String(this.receivedCalls.length)}`,
          ),
        );
      }
      return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome);
    },
  };
}
