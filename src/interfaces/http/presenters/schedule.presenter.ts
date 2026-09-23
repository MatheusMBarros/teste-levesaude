import type { Doctor } from '../../../domain/entities/doctor.entity';

/** Item de `medicos` no contrato 1 (`GET /agendas`). Chaves literais do enunciado (D11). */
export interface DoctorScheduleBody {
  readonly id: number;
  readonly nome: string;
  readonly especialidade: string;
  readonly horarios_disponiveis: ReadonlyArray<string>;
}

/** Corpo 200 de `GET /agendas`. */
export interface ScheduleListBody {
  readonly medicos: ReadonlyArray<DoctorScheduleBody>;
}

function presentDoctor(doctor: Doctor): DoctorScheduleBody {
  return {
    id: doctor.id,
    nome: doctor.name,
    especialidade: doctor.specialty,
    horarios_disponiveis: doctor.availableSlots.map((slot) => slot.toString()),
  };
}

/** Mantém a ordem recebida (D23) e médicos sem horários livres (D21). */
export function presentSchedules(doctors: ReadonlyArray<Doctor>): ScheduleListBody {
  return { medicos: doctors.map(presentDoctor) };
}
