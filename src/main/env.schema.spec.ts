import { inspect } from 'node:util';

import { InvalidConfigError, loadTriageConfig } from './env.schema';

function thrownBy(action: () => unknown): unknown {
  try {
    action();
  } catch (error: unknown) {
    return error;
  }
  throw new Error('Esperava que a função lançasse, mas ela terminou normalmente');
}

describe('loadTriageConfig', () => {
  it('usa provider anthropic e modelo claude-sonnet-5 por padrão, sem chave (D17)', () => {
    const config = loadTriageConfig({});

    expect(config).toEqual({ provider: 'anthropic', model: 'claude-sonnet-5' });
  });

  it('lê provider, modelo e chave do ambiente', () => {
    const config = loadTriageConfig({
      TRIAGE_PROVIDER: 'anthropic',
      TRIAGE_MODEL: 'claude-outro-modelo',
      ANTHROPIC_API_KEY: 'sk-ant-test-key',
    });

    expect(config).toEqual({
      provider: 'anthropic',
      model: 'claude-outro-modelo',
      apiKey: 'sk-ant-test-key',
    });
  });

  it('aceita o provider fake', () => {
    const config = loadTriageConfig({ TRIAGE_PROVIDER: 'fake' });

    expect(config.provider).toBe('fake');
  });

  it("trata ANTHROPIC_API_KEY vazia ('' do serverless.yml) como ausente", () => {
    const config = loadTriageConfig({ ANTHROPIC_API_KEY: '' });

    expect(config.apiKey).toBeUndefined();
  });

  it('ignora variáveis de ambiente não relacionadas à triagem', () => {
    const config = loadTriageConfig({ PATH: '/usr/bin', NODE_ENV: 'test' });

    expect(config).toEqual({ provider: 'anthropic', model: 'claude-sonnet-5' });
  });

  it('lança InvalidConfigError para TRIAGE_PROVIDER desconhecido', () => {
    expect(() => loadTriageConfig({ TRIAGE_PROVIDER: 'openai' })).toThrow(InvalidConfigError);
  });

  it('não expõe o valor recebido no InvalidConfigError (mensagem, stack e propriedades)', () => {
    const secretLikeValue = 'sk-ant-colado-no-lugar-errado';

    const error = thrownBy(() => loadTriageConfig({ TRIAGE_PROVIDER: secretLikeValue }));

    expect(error).toBeInstanceOf(InvalidConfigError);
    expect(inspect(error)).not.toContain(secretLikeValue);
  });
});
