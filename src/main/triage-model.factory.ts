import { Anthropic } from '@anthropic-ai/sdk';

import type { Logger } from '../application/ports/logger.port';
import type { TriageModel } from '../application/ports/triage-model.port';
import {
  ATTEMPT_TIMEOUT_MS,
  AnthropicTriageModel,
} from '../infrastructure/llm/anthropic-triage.model';
import { FakeTriageModel } from '../infrastructure/llm/fake-triage.model';
import { UnavailableTriageModel } from '../infrastructure/llm/unavailable-triage.model';
import { assertNever } from '../shared/assert-never';
import type { TriageConfig } from './env.schema';

/**
 * Escolhe a implementação de `TriageModel` pela configuração (D17):
 * - `fake` → `FakeTriageModel` (sem rede, mesmo que haja chave) e um aviso no log de boot;
 * - `anthropic` sem chave → `UnavailableTriageModel` (503) e um aviso no log de boot;
 * - `anthropic` com chave → `AnthropicTriageModel` com o SDK sem retentativa própria nem log
 *   (`maxRetries: 0`, `logLevel: 'off'`): a política de retentativa e os logs são do adapter
 *   (ADR-010).
 */
export function createTriageModel(config: TriageConfig, logger: Logger): TriageModel {
  switch (config.provider) {
    case 'fake':
      // Fake em deploy seria silencioso: a rota responde 200 sem LLM. O aviso deixa isso visível
      // no log de boot (ADR-009); o deploy exige `TRIAGE_PROVIDER=anthropic` explícito.
      logger.warn('TRIAGE_PROVIDER=fake: POST /triagem answers with keyword rules, not an LLM', {
        provider: config.provider,
      });
      return new FakeTriageModel();
    case 'anthropic':
      if (config.apiKey === undefined) {
        logger.warn('ANTHROPIC_API_KEY is not set: POST /triagem will answer 503', {
          provider: config.provider,
          model: config.model,
        });
        return new UnavailableTriageModel();
      }
      return new AnthropicTriageModel(
        new Anthropic({
          apiKey: config.apiKey,
          maxRetries: 0,
          timeout: ATTEMPT_TIMEOUT_MS,
          logLevel: 'off',
        }),
        logger,
        { model: config.model },
      );
    default:
      return assertNever(config.provider);
  }
}
