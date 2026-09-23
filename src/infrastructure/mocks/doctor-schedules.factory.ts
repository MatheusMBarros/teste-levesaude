import { DoctorSchedule } from '../../domain/entities/doctor-schedule.entity';
import { SlotDateTime } from '../../domain/value-objects/slot-date-time.value-object';
import type { DoctorSeed } from './doctors.seed';

function parseSlot(value: string, doctorId: number): SlotDateTime {
  const parsed = SlotDateTime.create(value);
  if (!parsed.ok) {
    throw new Error(`Invalid slot "${value}" in seed for doctor ${String(doctorId)}`);
  }
  return parsed.value;
}

function assertUniqueDoctorIds(seed: ReadonlyArray<DoctorSeed>): void {
  const seen = new Set<number>();
  for (const { id } of seed) {
    if (seen.has(id)) {
      throw new Error(`Duplicate doctor id ${String(id)} in seed`);
    }
    seen.add(id);
  }
}

function assertUniqueSlots(doctor: DoctorSeed): void {
  const seen = new Set<string>();
  for (const value of doctor.availableSlots) {
    if (seen.has(value)) {
      throw new Error(`Duplicate slot "${value}" in seed for doctor ${String(doctor.id)}`);
    }
    seen.add(value);
  }
}

function toDoctorSchedule(seed: DoctorSeed): DoctorSchedule {
  assertUniqueSlots(seed);
  return DoctorSchedule.create({
    doctorId: seed.id,
    doctorName: seed.name,
    specialty: seed.specialty,
    offeredSlots: seed.availableSlots.map((value) => parseSlot(value, seed.id)),
  });
}

/**
 * Converte o seed em agregados. Seed inconsistente (data inválida, id ou horário repetido) é bug de
 * dados, não erro de negócio: lança e falha na inicialização (ADR-004). Id repetido deixaria o
 * segundo médico inalcançável no repositório.
 */
export function createDoctorSchedules(
  seed: ReadonlyArray<DoctorSeed>,
): ReadonlyArray<DoctorSchedule> {
  assertUniqueDoctorIds(seed);
  return seed.map(toDoctorSchedule);
}
