import type { SlotDateTime } from '../value-objects/slot-date-time.value-object';
import { DomainError } from './domain.error';

/**
 * Violação do invariante de `DoctorSchedule`: o mesmo horário ofertado mais de uma vez.
 * Não faz parte da união de erros de nenhum caso de uso: agendas só são criadas a partir do seed,
 * onde isso é bug de dados e vira falha na inicialização (ADR-005).
 */
export class DuplicateSlotError extends DomainError {
  override readonly code = 'DUPLICATE_SLOT';

  constructor(
    readonly doctorId: number,
    readonly slot: SlotDateTime,
  ) {
    super(`Slot ${slot.toString()} is offered more than once by doctor ${String(doctorId)}`);
  }
}
