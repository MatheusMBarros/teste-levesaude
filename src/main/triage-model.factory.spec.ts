import type { LogCapture } from '../../tests/helpers/fakes/log-capture';
import { captureLogs } from '../../tests/helpers/fakes/log-capture';
import type { Logger } from '../application/ports/logger.port';
import { AnthropicTriageModel } from '../infrastructure/llm/anthropic-triage.model';
import { FakeTriageModel } from '../infrastructure/llm/fake-triage.model';
import { UnavailableTriageModel } from '../infrastructure/llm/unavailable-triage.model';
import { JsonLogger } from '../infrastructure/logger/json.logger';
import { createTriageModel } from './triage-model.factory';

const API_KEY = 'sk-ant-api03-chave-de-teste-nao-real';

function makeLogger(): { logger: Logger; logs: LogCapture } {
  const logs = captureLogs();
  return { logger: new JsonLogger(logs.write), logs };
}

describe('createTriageModel', () => {
  it('cria o FakeTriageModel quando TRIAGE_PROVIDER=fake, mesmo com chave', () => {
    const { logger } = makeLogger();

    const model = createTriageModel(
      { provider: 'fake', model: 'claude-sonnet-5', apiKey: API_KEY },
      logger,
    );

    expect(model).toBeInstanceOf(FakeTriageModel);
  });

  it('cria o UnavailableTriageModel quando o provider é anthropic e não há chave (503, D17)', () => {
    const { logger } = makeLogger();

    const model = createTriageModel({ provider: 'anthropic', model: 'claude-sonnet-5' }, logger);

    expect(model).toBeInstanceOf(UnavailableTriageModel);
  });

  it('avisa no log de boot que a triagem ficará indisponível sem chave', () => {
    const { logger, logs } = makeLogger();

    createTriageModel({ provider: 'anthropic', model: 'claude-sonnet-5' }, logger);

    expect(logs.ofLevel('warn')).toHaveLength(1);
  });

  it('cria o AnthropicTriageModel quando o provider é anthropic e há chave', () => {
    const { logger } = makeLogger();

    const model = createTriageModel(
      { provider: 'anthropic', model: 'claude-sonnet-5', apiKey: API_KEY },
      logger,
    );

    expect(model).toBeInstanceOf(AnthropicTriageModel);
  });

  it('não escreve a chave da API em nenhum log', () => {
    const { logger, logs } = makeLogger();

    createTriageModel({ provider: 'anthropic', model: 'claude-sonnet-5', apiKey: API_KEY }, logger);

    expect(logs.text).not.toContain(API_KEY);
  });

  it('avisa no log de boot que o provider fake está ativo, sem dados sensíveis', () => {
    const { logger, logs } = makeLogger();

    createTriageModel({ provider: 'fake', model: 'claude-sonnet-5', apiKey: API_KEY }, logger);

    expect(logs.ofLevel('warn')).toEqual([
      expect.objectContaining({
        provider: 'fake',
        message: 'TRIAGE_PROVIDER=fake: POST /triagem answers with keyword rules, not an LLM',
      }),
    ]);
    expect(logs.text).not.toContain(API_KEY);
  });

  it('não emite aviso quando o provider é anthropic com chave', () => {
    const { logger, logs } = makeLogger();

    createTriageModel({ provider: 'anthropic', model: 'claude-sonnet-5', apiKey: API_KEY }, logger);

    expect(logs.ofLevel('warn')).toEqual([]);
  });
});
