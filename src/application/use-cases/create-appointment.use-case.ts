import type { Appointment } from '../../domain/entities/appointment.entity';
import type { SlotDateTime } from '../../domain/value-objects/slot-date-time.value-object';
import type { Result } from '../../shared/result';
import { err, ok } from '../../shared/result';
import type { AppointmentRepository } from '../ports/appointment-repository.port';
import type { IdGenerator } from '../ports/id-generator.port';
import type { ReserveSlotError, ScheduleRepository } from '../ports/schedule-repository.port';
import type { UseCase } from './use-case';

/**
 * Entrada já validada na borda. `slot` chega como `SlotDateTime` (parse, don't validate):
 * o caso de uso não precisa lidar com texto de data inválido (ADR-004).
 * `patient` já vem com trim e 3–120 caracteres (D12, validado pelo schema HTTP).
 */
export interface CreateAppointmentInput {
  readonly doctorId: number;
  readonly patient: string;
  readonly slot: SlotDateTime;
}

export type CreateAppointmentError = ReserveSlotError;

/**
 * A disponibilidade é decidida só pela reserva atômica do repositório (sem check-then-act, D14).
 * Erros de negócio voltam no `Result`; nunca lança por eles.
 */
export class CreateAppointmentUseCase implements UseCase<
  CreateAppointmentInput,
  Result<Appointment, CreateAppointmentError>
> {
  constructor(
    private readonly scheduleRepository: ScheduleRepository,
    private readonly appointmentRepository: AppointmentRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(
    input: CreateAppointmentInput,
  ): Promise<Result<Appointment, CreateAppointmentError>> {
    const reservation = await this.scheduleRepository.reserveSlot(input.doctorId, input.slot);
    if (!reservation.ok) {
      return err(reservation.error);
    }

    const appointment: Appointment = {
      id: this.idGenerator.generate(),
      doctorId: input.doctorId,
      doctorName: reservation.value.name,
      patient: input.patient,
      slot: input.slot,
    };
    await this.appointmentRepository.save(appointment);
    return ok(appointment);
  }
}
