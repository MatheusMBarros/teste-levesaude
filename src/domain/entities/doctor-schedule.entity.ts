import type { Result } from '../../shared/result';
import type { SlotNotOfferedError } from '../errors/slot-not-offered.error';
import type { SlotUnavailableError } from '../errors/slot-unavailable.error';
import type { SlotDateTime } from '../value-objects/slot-date-time.value-object';
import type { Doctor } from './doctor.entity';

export type ReserveError = SlotNotOfferedError | SlotUnavailableError;

export interface DoctorScheduleProps {
  readonly doctorId: number;
  readonly doctorName: string;
  readonly specialty: string;
  readonly offeredSlots: ReadonlyArray<SlotDateTime>;
}

/**
 * Agregado imutável da agenda de um médico: horários ofertados e horários já reservados.
 * Concentra a regra de negócio da reserva (ADR-004):
 * - horário fora de `offeredSlots` → `SlotNotOfferedError` (422, ADR-003);
 * - horário ofertado mas já reservado → `SlotUnavailableError` (409);
 * - senão, devolve uma **nova** instância com o horário reservado.
 * Por ser puro e síncrono, o repositório o usa dentro da seção atômica sem check-then-act (D14).
 */
export class DoctorSchedule {
  private constructor(
    private readonly props: DoctorScheduleProps,
    private readonly reservedSlots: ReadonlyArray<SlotDateTime>,
  ) {}

  static create(props: DoctorScheduleProps): DoctorSchedule {
    return new DoctorSchedule(props, []);
  }

  get doctorId(): number {
    return this.props.doctorId;
  }

  reserve(slot: SlotDateTime): Result<DoctorSchedule, ReserveError> {
    // eslint-disable-next-line @typescript-eslint/no-meaningless-void-operator -- stub da etapa de contratos; removido na implementação (TDD)
    void [slot, this.reservedSlots];
    throw new Error('Not implemented');
  }

  /** Visão de leitura: `availableSlots` = ofertados − reservados, na ordem do seed. */
  toDoctor(): Doctor {
    throw new Error('Not implemented');
  }
}
