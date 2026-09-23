import type {
  ReserveSlotError,
  ScheduleRepository,
} from '../../../src/application/ports/schedule-repository.port';
import type { Doctor } from '../../../src/domain/entities/doctor.entity';
import type { DoctorSchedule } from '../../../src/domain/entities/doctor-schedule.entity';
import { DoctorNotFoundError } from '../../../src/domain/errors/doctor-not-found.error';
import type { SlotDateTime } from '../../../src/domain/value-objects/slot-date-time.value-object';
import type { Result } from '../../../src/shared/result';
import { err, ok } from '../../../src/shared/result';

export interface ReserveSlotCall {
  readonly doctorId: number;
  readonly slot: SlotDateTime;
}

/**
 * Fake de `ScheduleRepository` em memória. Reutiliza o agregado `DoctorSchedule` para a regra
 * 422/409 (não a reimplementa); só decide o 404 e substitui a instância. Tudo síncrono, sem
 * `await` entre ler e gravar, como exige a reserva atômica (D14, ADR-004).
 * Registra as chamadas para os testes provarem a ausência de check-then-act.
 */
export class FakeScheduleRepository implements ScheduleRepository {
  private readonly schedules: DoctorSchedule[];
  private readonly reserveCalls: ReserveSlotCall[] = [];
  private listCallCount = 0;

  constructor(schedules: ReadonlyArray<DoctorSchedule> = []) {
    this.schedules = [...schedules];
  }

  get listCalls(): number {
    return this.listCallCount;
  }

  get reserveSlotCalls(): ReadonlyArray<ReserveSlotCall> {
    return this.reserveCalls;
  }

  list(): Promise<ReadonlyArray<Doctor>> {
    this.listCallCount += 1;
    return Promise.resolve(this.schedules.map((schedule) => schedule.toDoctor()));
  }

  reserveSlot(doctorId: number, slot: SlotDateTime): Promise<Result<Doctor, ReserveSlotError>> {
    this.reserveCalls.push({ doctorId, slot });

    const index = this.schedules.findIndex((schedule) => schedule.doctorId === doctorId);
    const current = this.schedules[index];
    if (current === undefined) {
      return Promise.resolve(err(new DoctorNotFoundError(doctorId)));
    }

    const reserved = current.reserve(slot);
    if (!reserved.ok) {
      return Promise.resolve(err(reserved.error));
    }

    this.schedules[index] = reserved.value;
    return Promise.resolve(ok(reserved.value.toDoctor()));
  }
}
