import type { LogContext, Logger } from '../../application/ports/logger.port';

export type LogWriter = (line: string) => void;

type LogLevel = 'info' | 'warn' | 'error';

// JSON.stringify serializa Error como `{}`; sem isso a causa de um 500 some do log.
function serializeErrors(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
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
