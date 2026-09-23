import type {
  ContentBlock,
  Message,
  StopReason,
  Usage,
} from '@anthropic-ai/sdk/resources/messages';

import { TRIAGE_TOOL_NAME } from '../../../src/infrastructure/llm/prompts/triage.prompt.v1';

/**
 * Resposta de `messages.create` como o SDK a entrega: o `Message` da API mais o `_request_id`
 * que o SDK anexa (`WithRequestID`). Tipos reais do SDK, sem asserção.
 */
export type AnthropicMessage = Message & { readonly _request_id?: string | null };

export interface AnthropicMessageOptions {
  readonly stopReason?: StopReason;
  /** Nome da tool no bloco `tool_use`; padrão `submit_triage`. */
  readonly toolName?: string;
  readonly requestId?: string;
}

const USAGE: Usage = {
  cache_creation: null,
  cache_creation_input_tokens: null,
  cache_read_input_tokens: null,
  inference_geo: null,
  input_tokens: 812,
  output_tokens: 64,
  output_tokens_details: null,
  server_tool_use: null,
  service_tier: 'standard',
};

function aMessage(
  content: ContentBlock[],
  stopReason: StopReason,
  requestId: string,
): AnthropicMessage {
  return {
    id: 'msg_test_01',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5',
    container: null,
    content,
    stop_details: null,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: USAGE,
    _request_id: requestId,
  };
}

/**
 * Resposta com um bloco `tool_use` da tool de triagem. `input` é livre (`unknown`) para testar
 * saídas inválidas do modelo. Uso: `aToolUseMessage({ specialty: 'Cardiologista', ... })`.
 */
export function aToolUseMessage(
  input: unknown,
  options: AnthropicMessageOptions = {},
): AnthropicMessage {
  return aMessage(
    [
      {
        type: 'tool_use',
        id: 'toolu_test_01',
        name: options.toolName ?? TRIAGE_TOOL_NAME,
        input,
        caller: { type: 'direct' },
      },
    ],
    options.stopReason ?? 'tool_use',
    options.requestId ?? 'req_test_01',
  );
}

/** Resposta só com texto (o modelo não chamou a tool): saída inválida para o adapter. */
export function aTextOnlyMessage(
  text = 'Não posso ajudar com isso.',
  options: AnthropicMessageOptions = {},
): AnthropicMessage {
  return aMessage(
    [{ type: 'text', text, citations: null }],
    options.stopReason ?? 'end_turn',
    options.requestId ?? 'req_test_01',
  );
}

/** Entrada válida da tool `submit_triage`; os campos passados substituem os padrões. */
export function aTriageToolInput(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    specialty: 'Cardiologista',
    urgency: 'media',
    rationale: 'Dor no peito aos esforços e palpitações sugerem avaliação cardiológica.',
    ...overrides,
  };
}
