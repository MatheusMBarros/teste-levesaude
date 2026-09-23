import { z } from 'zod';

export const TRIAGE_PROVIDERS = ['anthropic', 'fake'] as const;

export type TriageProvider = (typeof TRIAGE_PROVIDERS)[number];

/** Padrão de `TRIAGE_MODEL` (ADR-011). */
export const DEFAULT_TRIAGE_MODEL = 'claude-sonnet-5';

/** Variáveis de ambiente como `process.env` as entrega. */
export type Environment = Readonly<Record<string, string | undefined>>;

export interface TriageConfig {
  readonly provider: TriageProvider;
  readonly model: string;
  /** Ausente quando a variável não existe ou está vazia. Nunca vai para log. */
  readonly apiKey?: string;
}

/**
 * Configuração inválida no boot. A mensagem cita só o nome da variável: o valor recebido pode ser
 * um segredo colado no lugar errado. Sem `cause`, pelo mesmo motivo.
 */
export class InvalidConfigError extends Error {
  constructor(readonly variable: string) {
    super(`Invalid value for environment variable ${variable}`);
    this.name = 'InvalidConfigError';
  }
}

// `''` conta como ausente: o `serverless.yml` usa `${env:ANTHROPIC_API_KEY, ''}` como padrão.
const optionalText = z
  .string()
  .optional()
  .transform((value) => (value === '' ? undefined : value));

const triageEnvSchema = z.object({
  TRIAGE_PROVIDER: optionalText.pipe(z.enum(TRIAGE_PROVIDERS).default('anthropic')),
  TRIAGE_MODEL: optionalText.pipe(z.string().default(DEFAULT_TRIAGE_MODEL)),
  ANTHROPIC_API_KEY: optionalText,
});

/**
 * Lê a configuração da triagem (D17). Padrões: provider `anthropic`, modelo `claude-sonnet-5`.
 * Provider desconhecido é erro de configuração (lança `InvalidConfigError`); chave ausente não é:
 * vira 503 na triagem, sem derrubar as outras rotas.
 */
export function loadTriageConfig(env: Environment): TriageConfig {
  const parsed = triageEnvSchema.safeParse(env);
  if (!parsed.success) {
    const variable = parsed.error.issues[0]?.path.map(String).join('.') ?? 'unknown';
    throw new InvalidConfigError(variable);
  }
  const { TRIAGE_PROVIDER, TRIAGE_MODEL, ANTHROPIC_API_KEY } = parsed.data;
  return {
    provider: TRIAGE_PROVIDER,
    model: TRIAGE_MODEL,
    ...(ANTHROPIC_API_KEY === undefined ? {} : { apiKey: ANTHROPIC_API_KEY }),
  };
}
