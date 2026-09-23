import type { Doctor } from '../../domain/entities/doctor.entity';
import type { DoctorNotFoundError } from '../../domain/errors/doctor-not-found.error';
import type { SlotNotOfferedError } from '../../domain/errors/slot-not-offered.error';
import type { SlotUnavailableError } from '../../domain/errors/slot-unavailable.error';
import type { SlotDateTime } from '../../domain/value-objects/slot-date-time.value-object';
import type { Result } from '../../shared/result';

export type ReserveSlotError = DoctorNotFoundError | SlotNotOfferedError | SlotUnavailableError;

/** Agenda dos médicos. Ver ADR-004. */
export interface ScheduleRepository {
  /** Todos os médicos, cada um só com os horários ainda disponíveis. */
  list(): Promise<ReadonlyArray<Doctor>>;

  /**
   * Reserva o horário de forma **atômica** (D14): verificação e marcação acontecem numa única
   * operação, sem janela entre elas. Precedência dos erros:
   * 1. `DoctorNotFoundError` — médico inexistente;
   * 2. `SlotNotOfferedError` — horário nunca ofertado pelo médico;
   * 3. `SlotUnavailableError` — horário ofertado, mas já reservado.
   * Em sucesso, devolve o médico já sem o horário reservado. Erros de negócio vêm no `Result`;
   * a Promise só rejeita em falha inesperada de infraestrutura.
   */
  reserveSlot(doctorId: number, slot: SlotDateTime): Promise<Result<Doctor, ReserveSlotError>>;
}
