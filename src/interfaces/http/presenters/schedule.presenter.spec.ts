import { aDoctorSchedule } from '../../../../tests/helpers/builders/doctor-schedule.builder';
import type { Doctor } from '../../../domain/entities/doctor.entity';
import { presentSchedules } from './schedule.presenter';

function drJoao(): Doctor {
  return aDoctorSchedule()
    .withId(1)
    .withName('Dr. João Silva')
    .withSpecialty('Cardiologista')
    .withSlots(['2026-06-10 09:00', '2026-06-10 10:00', '2026-06-10 11:00'])
    .build()
    .toDoctor();
}

function draMaria(): Doctor {
  return aDoctorSchedule()
    .withId(2)
    .withName('Dra. Maria Souza')
    .withSpecialty('Dermatologista')
    .withSlots(['2026-06-11 14:00', '2026-06-11 15:00'])
    .build()
    .toDoctor();
}

describe('presentSchedules', () => {
  it('converte os médicos para o contrato snake_case do GET /agendas, na ordem recebida', () => {
    const body = presentSchedules([drJoao(), draMaria()]);

    expect(body).toEqual({
      medicos: [
        {
          id: 1,
          nome: 'Dr. João Silva',
          especialidade: 'Cardiologista',
          horarios_disponiveis: ['2026-06-10 09:00', '2026-06-10 10:00', '2026-06-10 11:00'],
        },
        {
          id: 2,
          nome: 'Dra. Maria Souza',
          especialidade: 'Dermatologista',
          horarios_disponiveis: ['2026-06-11 14:00', '2026-06-11 15:00'],
        },
      ],
    });
  });

  it('mantém o médico sem horários livres com horarios_disponiveis vazio (D21)', () => {
    const fullyBooked = aDoctorSchedule()
      .withId(2)
      .withName('Dra. Maria Souza')
      .withSpecialty('Dermatologista')
      .withSlots(['2026-06-11 14:00'])
      .withReservedSlots(['2026-06-11 14:00'])
      .build()
      .toDoctor();

    const body = presentSchedules([fullyBooked]);

    expect(body.medicos).toEqual([
      {
        id: 2,
        nome: 'Dra. Maria Souza',
        especialidade: 'Dermatologista',
        horarios_disponiveis: [],
      },
    ]);
  });

  it('devolve lista vazia de médicos quando não há médicos', () => {
    const body = presentSchedules([]);

    expect(body).toEqual({ medicos: [] });
  });
});
