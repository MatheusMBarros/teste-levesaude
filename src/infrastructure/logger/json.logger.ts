import type { LogContext, Logger } from '../../application/ports/logger.port';

export type LogWriter = (line: string) => void;

type LogLevel = 'info' | 'warn' | 'error';

/** Destino mínimo de escrita, compatível com `process.stdout`. */
export interface TextOutputStream {
  write(chunk: string): unknown;
}

/**
 * `LogWriter` que termina cada linha com `\n`. Chama `stream.write` a cada escrita, em vez de
 * guardar a referência do método: mantém o `this` do stream e respeita substituições posteriores.
 */
export function createLineWriter(stream: TextOutputStream): LogWriter {
  return (line) => {
    stream.write(`${line}\n`);
  };
}

export const stdoutWriter: LogWriter = createLineWriter(process.stdout);

// `code` identifica o DomainError (ex.: lançado por engano) sem depender do texto da mensagem.
function serializeError(error: Error): Readonly<Record<string, unknown>> {
  const base = { name: error.name, message: error.message, stack: error.stack };
  return 'code' in error && typeof error.code === 'string' ? { ...base, code: error.code } : base;
}

// JSON.stringify serializa Error como `{}`; sem isso a causa de um 500 some do log.
function serializeErrors(_key: string, value: unknown): unknown {
  return value instanceof Error ? serializeError(value) : value;
}

/** Uma linha JSON por evento (formato que o CloudWatch indexa). Ver ADR-005. */
export class JsonLogger implements Logger {
  constructor(
    private readonly write: LogWriter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  private log(level: LogLevel, message: string, context: LogContext = {}): void {
    const fixed = { level, timestamp: this.now().toISOString(), message };
    this.write(this.stringify({ ...context, ...fixed }) ?? JSON.stringify(fixed));
  }

  // Contexto não serializável (ex.: circular) não pode derrubar a requisição: é descartado.
  // Falhas do próprio `write` são responsabilidade de quem o injeta (ADR-005).
  private stringify(entry: LogContext): string | undefined {
    try {
      return JSON.stringify(entry, serializeErrors);
    } catch {
      return undefined;
    }
  }
}
