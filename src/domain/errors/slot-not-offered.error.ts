import type { SlotDateTime } from '../value-objects/slot-date-time.value-object';
import { DomainError } from './domain.error';

/** O horário nunca fez parte da agenda do médico (D5, ADR-003). */
export class SlotNotOfferedError extends DomainError {
  override readonly code = 'SLOT_NOT_OFFERED';

  constructor(
    readonly doctorId: number,
    readonly slot: SlotDateTime,
  ) {
    super(`Doctor ${String(doctorId)} does not offer slot ${slot.toString()}`);
  }
}
