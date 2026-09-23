import { aDoctorSchedule } from '../../../tests/helpers/builders/doctor-schedule.builder';
import { FakeScheduleRepository } from '../../../tests/helpers/fakes/fake-schedule.repository';
import type { Doctor } from '../../domain/entities/doctor.entity';
import { ListSchedulesUseCase } from './list-schedules.use-case';

function toPlain(doctor: Doctor): {
  id: number;
  name: string;
  specialty: string;
  availableSlots: ReadonlyArray<string>;
} {
  return {
    id: doctor.id,
    name: doctor.name,
    specialty: doctor.specialty,
    availableSlots: doctor.availableSlots.map((available) => available.toString()),
  };
}

describe('ListSchedulesUseCase', () => {
  it('retorna os médicos com horários disponíveis', async () => {
    const scheduleRepository = new FakeScheduleRepository([
      aDoctorSchedule()
        .withId(1)
        .withName('Dr. João Silva')
        .withSpecialty('Cardiologista')
        .withSlots(['2026-06-10 09:00', '2026-06-10 10:00', '2026-06-10 11:00'])
        .withReservedSlots(['2026-06-10 10:00'])
        .build(),
      aDoctorSchedule()
        .withId(2)
        .withName('Dra. Maria Souza')
        .withSpecialty('Dermatologista')
        .withSlots(['2026-06-11 14:00', '2026-06-11 15:00'])
        .build(),
    ]);
    const sut = new ListSchedulesUseCase(scheduleRepository);

    const doctors = await sut.execute();

    expect(doctors.map(toPlain)).toEqual([
      {
        id: 1,
        name: 'Dr. João Silva',
        specialty: 'Cardiologista',
        availableSlots: ['2026-06-10 09:00', '2026-06-10 11:00'],
      },
      {
        id: 2,
        name: 'Dra. Maria Souza',
        specialty: 'Dermatologista',
        availableSlots: ['2026-06-11 14:00', '2026-06-11 15:00'],
      },
    ]);
  });

  it('retorna lista vazia quando não há médicos', async () => {
    const sut = new ListSchedulesUseCase(new FakeScheduleRepository([]));

    const doctors = await sut.execute();

    expect(doctors).toEqual([]);
  });

  it('preserva a ordem do repositório', async () => {
    const scheduleRepository = new FakeScheduleRepository([
      aDoctorSchedule().withId(3).build(),
      aDoctorSchedule().withId(1).build(),
      aDoctorSchedule().withId(2).build(),
    ]);
    const sut = new ListSchedulesUseCase(scheduleRepository);

    const doctors = await sut.execute();

    expect(doctors.map((doctor) => doctor.id)).toEqual([3, 1, 2]);
  });
});
