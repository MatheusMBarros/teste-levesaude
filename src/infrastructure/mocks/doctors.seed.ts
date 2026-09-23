import type { Specialty } from '../../domain/value-objects/specialty.value-object';

/**
 * Registro bruto de um médico no seed: dados planos, com horários em texto `YYYY-MM-DD HH:mm`
 * (D2). Fica em texto para o arquivo espelhar o enunciado; a conversão para o agregado
 * `DoctorSchedule` é feita por `createDoctorSchedules` (ver ADR-005).
 */
export interface DoctorSeed {
  readonly id: number;
  readonly name: string;
  readonly specialty: Specialty;
  readonly availableSlots: ReadonlyArray<string>;
}

/**
 * Médicos mockados. Os médicos 1 e 2 são **idênticos** ao enunciado; os 3, 4 e 5 existem para a
 * triagem (Fase 5) ter para onde apontar. A ordem aqui é a ordem da resposta do GET /agendas (D23).
 */
export const DOCTORS_SEED: ReadonlyArray<DoctorSeed> = [
  {
    id: 1,
    name: 'Dr. João Silva',
    specialty: 'Cardiologista',
    availableSlots: ['2026-06-10 09:00', '2026-06-10 10:00', '2026-06-10 11:00'],
  },
  {
    id: 2,
    name: 'Dra. Maria Souza',
    specialty: 'Dermatologista',
    availableSlots: ['2026-06-11 14:00', '2026-06-11 15:00'],
  },
  {
    id: 3,
    name: 'Dra. Ana Pereira',
    specialty: 'Pediatra',
    availableSlots: ['2026-06-12 08:00', '2026-06-12 09:00', '2026-06-12 10:00'],
  },
  {
    id: 4,
    name: 'Dr. Ricardo Lima',
    specialty: 'Ortopedista',
    availableSlots: ['2026-06-15 13:00', '2026-06-15 14:00'],
  },
  {
    id: 5,
    name: 'Dra. Fernanda Costa',
    specialty: 'Clínico Geral',
    availableSlots: ['2026-06-16 08:00', '2026-06-16 09:00', '2026-06-16 10:00'],
  },
];
