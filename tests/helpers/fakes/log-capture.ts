import type { LogWriter } from '../../../src/infrastructure/logger/json.logger';

/** Uma linha de log já desserializada. */
export type LogEntry = Readonly<Record<string, unknown>>;

function isLogEntry(value: unknown): value is LogEntry {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Captura as linhas escritas pelo `JsonLogger` (via `LogWriter`) em vez de mandá-las ao stdout.
 * Tolera quebra de linha final, caso o writer receba linhas já terminadas em `\n`.
 */
export class LogCapture {
  private readonly lines: string[] = [];

  readonly write: LogWriter = (line) => {
    this.lines.push(line);
  };

  get entries(): ReadonlyArray<LogEntry> {
    return this.lines
      .flatMap((line) => line.split('\n'))
      .filter((line) => line.trim() !== '')
      .map((line) => {
        const parsed: unknown = JSON.parse(line);
        if (!isLogEntry(parsed)) {
          throw new Error(`Linha de log não é um objeto JSON: ${line}`);
        }
        return parsed;
      });
  }

  ofLevel(level: 'info' | 'warn' | 'error'): ReadonlyArray<LogEntry> {
    return this.entries.filter((entry) => entry.level === level);
  }

  /** Texto bruto de tudo o que foi logado; útil para procurar nomes e mensagens. */
  get text(): string {
    return this.lines.join('\n');
  }
}

export function captureLogs(): LogCapture {
  return new LogCapture();
}
