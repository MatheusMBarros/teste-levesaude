import type {
  ReserveSlotError,
  ScheduleRepository,
} from '../../application/ports/schedule-repository.port';
import type { Doctor } from '../../domain/entities/doctor.entity';
import type { DoctorSchedule } from '../../domain/entities/doctor-schedule.entity';
import { DoctorNotFoundError } from '../../domain/errors/doctor-not-found.error';
import type { SlotDateTime } from '../../domain/value-objects/slot-date-time.value-object';
import type { Result } from '../../shared/result';
import { err, ok } from '../../shared/result';

/** Agenda em memória, viva enquanto o processo/container existir (D7). Ver ADR-005. */
export class InMemoryScheduleRepository implements ScheduleRepository {
  private readonly schedules: DoctorSchedule[];

  constructor(schedules: ReadonlyArray<DoctorSchedule>) {
    this.schedules = [...schedules];
  }

  list(): Promise<ReadonlyArray<Doctor>> {
    return Promise.resolve(this.schedules.map((schedule) => schedule.toDoctor()));
  }

  reserveSlot(doctorId: number, slot: SlotDateTime): Promise<Result<Doctor, ReserveSlotError>> {
    return Promise.resolve(this.reserveSlotSync(doctorId, slot));
  }

  // Síncrono de propósito: sem await entre ler e gravar, reservas concorrentes não se intercalam (D14).
  private reserveSlotSync(doctorId: number, slot: SlotDateTime): Result<Doctor, ReserveSlotError> {
    const index = this.schedules.findIndex((schedule) => schedule.doctorId === doctorId);
    const current = this.schedules[index];
    if (current === undefined) {
      return err(new DoctorNotFoundError(doctorId));
    }
    const reserved = current.reserve(slot);
    if (!reserved.ok) {
      return reserved;
    }
    this.schedules[index] = reserved.value;
    return ok(reserved.value.toDoctor());
  }
}
