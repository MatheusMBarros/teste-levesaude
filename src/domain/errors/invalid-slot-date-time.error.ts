import { DomainError } from './domain.error';

/**
 * Violação do invariante de `SlotDateTime` (formato `YYYY-MM-DD HH:mm` + data real).
 * Não faz parte da união de erros de nenhum caso de uso: o texto é convertido em
 * `SlotDateTime` na borda (schema HTTP), então este erro vira 400 lá (ADR-002, ADR-004).
 */
export class InvalidSlotDateTimeError extends DomainError {
  override readonly code = 'INVALID_SLOT_DATE_TIME';

  constructor(readonly value: string) {
    super(`Invalid slot date-time: "${value}"`);
  }
}
