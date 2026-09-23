import { DoctorSchedule } from '../../../src/domain/entities/doctor-schedule.entity';
import type { Specialty } from '../../../src/domain/value-objects/specialty.value-object';
import { slot } from './slot';

/**
 * Builder do agregado `DoctorSchedule` com valores padrão válidos.
 * Uso: `aDoctorSchedule().withId(2).withSlots(['2026-06-11 14:00']).build()`.
 */
export class DoctorScheduleBuilder {
  private doctorId = 1;
  private doctorName = 'Dr. João Silva';
  private specialty: Specialty = 'Cardiologista';
  private offeredSlots: ReadonlyArray<string> = [
    '2026-06-10 09:00',
    '2026-06-10 10:00',
    '2026-06-10 11:00',
  ];
  private reservedSlots: ReadonlyArray<string> = [];

  withId(doctorId: number): this {
    this.doctorId = doctorId;
    return this;
  }

  withName(doctorName: string): this {
    this.doctorName = doctorName;
    return this;
  }

  withSpecialty(specialty: Specialty): this {
    this.specialty = specialty;
    return this;
  }

  withSlots(offeredSlots: ReadonlyArray<string>): this {
    this.offeredSlots = offeredSlots;
    return this;
  }

  /** Horários (já ofertados) que a agenda deve ter reservados ao ser construída. */
  withReservedSlots(reservedSlots: ReadonlyArray<string>): this {
    this.reservedSlots = reservedSlots;
    return this;
  }

  build(): DoctorSchedule {
    const created = DoctorSchedule.create({
      doctorId: this.doctorId,
      doctorName: this.doctorName,
      specialty: this.specialty,
      offeredSlots: this.offeredSlots.map(slot),
    });
    if (!created.ok) {
      throw new Error(`Dado de teste inválido: ${created.error.message}`);
    }
    const initial = created.value;

    return this.reservedSlots.reduce((schedule, reserved) => {
      const result = schedule.reserve(slot(reserved));
      if (!result.ok) {
        throw new Error(`Dado de teste inválido: não foi possível reservar "${reserved}"`);
      }
      return result.value;
    }, initial);
  }
}

export function aDoctorSchedule(): DoctorScheduleBuilder {
  return new DoctorScheduleBuilder();
}
