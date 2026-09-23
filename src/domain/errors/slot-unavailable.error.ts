import type { SlotDateTime } from '../value-objects/slot-date-time.value-object';
import { DomainError } from './domain.error';

/** O horário foi ofertado pelo médico, mas já está reservado (409 no contrato). */
export class SlotUnavailableError extends DomainError {
  override readonly code = 'SLOT_UNAVAILABLE';

  constructor(
    readonly doctorId: number,
    readonly slot: SlotDateTime,
  ) {
    super(`Slot ${slot.toString()} of doctor ${String(doctorId)} is already reserved`);
  }
}
