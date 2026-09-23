import type { Doctor } from '../../domain/entities/doctor.entity';
import { SlotDateTime } from '../../domain/value-objects/slot-date-time.value-object';
import { createDoctorSchedules } from './doctor-schedules.factory';
import type { DoctorSeed } from './doctors.seed';
import { DOCTORS_SEED } from './doctors.seed';

interface PlainDoctor {
  readonly id: number;
  readonly name: string;
  readonly specialty: string;
  readonly availableSlots: ReadonlyArray<string>;
}

function toPlain(doctor: Doctor): PlainDoctor {
  return {
    id: doctor.id,
    name: doctor.name,
    specialty: doctor.specialty,
    availableSlots: doctor.availableSlots.map((available) => available.toString()),
  };
}

function aSeed(overrides: Partial<DoctorSeed> = {}): DoctorSeed {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Dr. João Silva',
    specialty: overrides.specialty ?? 'Cardiologista',
    availableSlots: overrides.availableSlots ?? ['2026-06-10 09:00', '2026-06-10 10:00'],
  };
}

describe('createDoctorSchedules', () => {
  it('converte cada registro do seed em uma agenda, preservando a ordem', () => {
    const seed = [aSeed({ id: 3 }), aSeed({ id: 1 }), aSeed({ id: 2 })];

    const schedules = createDoctorSchedules(seed);

    expect(schedules.map((schedule) => schedule.doctorId)).toEqual([3, 1, 2]);
  });

  it('expõe os dados e os horários do seed como disponíveis', () => {
    const seed = [
      aSeed({
        id: 2,
        name: 'Dra. Maria Souza',
        specialty: 'Dermatologista',
        availableSlots: ['2026-06-11 14:00', '2026-06-11 15:00'],
      }),
    ];

    const schedules = createDoctorSchedules(seed);

    expect(schedules.map((schedule) => toPlain(schedule.toDoctor()))).toEqual([
      {
        id: 2,
        name: 'Dra. Maria Souza',
        specialty: 'Dermatologista',
        availableSlots: ['2026-06-11 14:00', '2026-06-11 15:00'],
      },
    ]);
  });

  it('devolve lista vazia quando o seed é vazio', () => {
    const schedules = createDoctorSchedules([]);

    expect(schedules).toEqual([]);
  });

  it('lança erro identificando o horário e o médico quando o seed contém data inválida', () => {
    const seed = [aSeed({ id: 42, availableSlots: ['2026-06-10 09:00', '2026-02-30 10:00'] })];

    const act = (): unknown => createDoctorSchedules(seed);

    expect(act).toThrow(/2026-02-30 10:00/);
    expect(act).toThrow(/42/);
  });

  it('não muta o seed recebido', () => {
    const seed = [aSeed({ id: 1 }), aSeed({ id: 2 })];
    const snapshot = structuredClone(seed);

    createDoctorSchedules(seed);

    expect(seed).toEqual(snapshot);
  });
});

describe('DOCTORS_SEED', () => {
  it('mantém os médicos 1 e 2 idênticos ao enunciado', () => {
    const enunciado: ReadonlyArray<DoctorSeed> = [
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
    ];

    const firstTwo = DOCTORS_SEED.slice(0, 2);

    expect(firstTwo).toEqual(enunciado);
  });

  it.each(['Pediatra', 'Ortopedista', 'Clínico Geral'])(
    'inclui um médico %s com horários em junho de 2026',
    (specialty) => {
      const doctor = DOCTORS_SEED.find((seed) => seed.specialty === specialty);

      expect(doctor?.availableSlots.length).toBeGreaterThan(0);
      expect(doctor?.availableSlots.every((value) => value.startsWith('2026-06-'))).toBe(true);
    },
  );

  it('não compila com especialidade fora da lista fechada', () => {
    const invalid: DoctorSeed = {
      id: 99,
      name: 'Dr. Fora da Lista',
      // @ts-expect-error: 'Neurologista' não faz parte de SPECIALTIES
      specialty: 'Neurologista',
      availableSlots: [],
    };

    expect(invalid.specialty).toBe('Neurologista');
  });

  it('usa ids únicos para os médicos', () => {
    const ids = DOCTORS_SEED.map((seed) => seed.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('contém apenas horários válidos no formato YYYY-MM-DD HH:mm', () => {
    const invalid = DOCTORS_SEED.flatMap((seed) => seed.availableSlots).filter(
      (value) => !SlotDateTime.create(value).ok,
    );

    expect(invalid).toEqual([]);
  });

  it('é convertido pela fábrica sem lançar erro', () => {
    const act = (): unknown => createDoctorSchedules(DOCTORS_SEED);

    expect(act).not.toThrow();
  });
});
