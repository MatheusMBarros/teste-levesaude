import type { Result } from '../../shared/result';
import { err, ok } from '../../shared/result';
import { SlotNotOfferedError } from '../errors/slot-not-offered.error';
import { SlotUnavailableError } from '../errors/slot-unavailable.error';
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
    if (!this.offers(slot)) {
      return err(new SlotNotOfferedError(this.doctorId, slot));
    }
    if (this.isReserved(slot)) {
      return err(new SlotUnavailableError(this.doctorId, slot));
    }
    return ok(new DoctorSchedule(this.props, [...this.reservedSlots, slot]));
  }

  /** Visão de leitura: `availableSlots` = ofertados − reservados, na ordem do seed. */
  toDoctor(): Doctor {
    return {
      id: this.props.doctorId,
      name: this.props.doctorName,
      specialty: this.props.specialty,
      availableSlots: this.props.offeredSlots.filter((offered) => !this.isReserved(offered)),
    };
  }

  private offers(slot: SlotDateTime): boolean {
    return this.props.offeredSlots.some((offered) => offered.equals(slot));
  }

  private isReserved(slot: SlotDateTime): boolean {
    return this.reservedSlots.some((reserved) => reserved.equals(slot));
  }
}
