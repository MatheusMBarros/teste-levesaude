/** Campos estruturados anexados a uma linha de log (ex.: `requestId`, `doctorId`). */
export type LogContext = Readonly<Record<string, unknown>>;

/** Log estruturado. Implementação JSON na Fase 3; consumido pelos decorators na Fase 4. */
export interface Logger {
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}
