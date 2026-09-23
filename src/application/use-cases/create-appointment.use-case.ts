import type { Appointment } from '../../domain/entities/appointment.entity';
import type { DoctorNotFoundError } from '../../domain/errors/doctor-not-found.error';
import type { SlotNotOfferedError } from '../../domain/errors/slot-not-offered.error';
import type { SlotUnavailableError } from '../../domain/errors/slot-unavailable.error';
import type { SlotDateTime } from '../../domain/value-objects/slot-date-time.value-object';
import type { Result } from '../../shared/result';
import type { AppointmentRepository } from '../ports/appointment-repository.port';
import type { IdGenerator } from '../ports/id-generator.port';
import type { ScheduleRepository } from '../ports/schedule-repository.port';
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

export type CreateAppointmentError =
  DoctorNotFoundError | SlotNotOfferedError | SlotUnavailableError;

/**
 * Fluxo esperado (sem check-then-act, D14):
 * 1. `scheduleRepository.reserveSlot(doctorId, slot)` — única verificação de disponibilidade;
 *    em erro, devolve `err(error)` sem gerar id nem persistir;
 * 2. `idGenerator.generate()`;
 * 3. monta `Appointment` com `doctorName` do médico retornado pela reserva;
 * 4. `appointmentRepository.save(appointment)`;
 * 5. `ok(appointment)`.
 * Nunca lança para erro de negócio.
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

  execute(input: CreateAppointmentInput): Promise<Result<Appointment, CreateAppointmentError>> {
    // Stub da etapa de contratos (Fase 2); implementado pelo dev-backend via TDD.
    // eslint-disable-next-line @typescript-eslint/no-meaningless-void-operator -- stub da etapa de contratos; removido na implementação (TDD)
    void [input, this.scheduleRepository, this.appointmentRepository, this.idGenerator];
    throw new Error('Not implemented');
  }
}
