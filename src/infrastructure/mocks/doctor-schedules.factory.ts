import { DoctorSchedule } from '../../domain/entities/doctor-schedule.entity';
import { SlotDateTime } from '../../domain/value-objects/slot-date-time.value-object';
import type { DoctorSeed } from './doctors.seed';

// Horário inválido no seed é bug de dados, não erro de negócio: falha na inicialização (ADR-004).
function parseSlot(value: string, doctorId: number): SlotDateTime {
  const parsed = SlotDateTime.create(value);
  if (!parsed.ok) {
    throw new Error(`Invalid slot "${value}" in seed for doctor ${String(doctorId)}`);
  }
  return parsed.value;
}

function toDoctorSchedule(seed: DoctorSeed): DoctorSchedule {
  return DoctorSchedule.create({
    doctorId: seed.id,
    doctorName: seed.name,
    specialty: seed.specialty,
    offeredSlots: seed.availableSlots.map((value) => parseSlot(value, seed.id)),
  });
}

export function createDoctorSchedules(
  seed: ReadonlyArray<DoctorSeed>,
): ReadonlyArray<DoctorSchedule> {
  return seed.map(toDoctorSchedule);
}
