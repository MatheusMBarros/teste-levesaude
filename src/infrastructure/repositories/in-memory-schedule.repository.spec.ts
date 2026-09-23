import { aDoctorSchedule } from '../../../tests/helpers/builders/doctor-schedule.builder';
import { slot } from '../../../tests/helpers/builders/slot';
import { expectErr, expectOk } from '../../../tests/helpers/result-assertions';
import type { Doctor } from '../../domain/entities/doctor.entity';
import type { DoctorSchedule } from '../../domain/entities/doctor-schedule.entity';
import { DoctorNotFoundError } from '../../domain/errors/doctor-not-found.error';
import { SlotNotOfferedError } from '../../domain/errors/slot-not-offered.error';
import { SlotUnavailableError } from '../../domain/errors/slot-unavailable.error';
import { createDoctorSchedules } from '../mocks/doctor-schedules.factory';
import { DOCTORS_SEED } from '../mocks/doctors.seed';
import { InMemoryScheduleRepository } from './in-memory-schedule.repository';

function slotsOf(doctor: Doctor | undefined): ReadonlyArray<string> {
  return (doctor?.availableSlots ?? []).map((available) => available.toString());
}

function drJoao(): DoctorSchedule {
  return aDoctorSchedule()
    .withId(1)
    .withName('Dr. João Silva')
    .withSpecialty('Cardiologista')
    .withSlots(['2026-06-10 09:00', '2026-06-10 10:00', '2026-06-10 11:00'])
    .build();
}

function draMaria(): DoctorSchedule {
  return aDoctorSchedule()
    .withId(2)
    .withName('Dra. Maria Souza')
    .withSpecialty('Dermatologista')
    .withSlots(['2026-06-11 14:00', '2026-06-11 15:00'])
    .build();
}

function makeSut(
  schedules: ReadonlyArray<DoctorSchedule> = [drJoao(), draMaria()],
): InMemoryScheduleRepository {
  return new InMemoryScheduleRepository(schedules);
}

async function findDoctor(
  repository: InMemoryScheduleRepository,
  doctorId: number,
): Promise<Doctor | undefined> {
  const doctors = await repository.list();
  return doctors.find((doctor) => doctor.id === doctorId);
}

describe('InMemoryScheduleRepository', () => {
  describe('list', () => {
    it('devolve os médicos na ordem recebida no construtor', async () => {
      const sut = makeSut([draMaria(), drJoao()]);

      const doctors = await sut.list();

      expect(doctors.map((doctor) => doctor.id)).toEqual([2, 1]);
    });

    it('devolve nome, especialidade e horários disponíveis de cada médico', async () => {
      const sut = makeSut([draMaria()]);

      const doctors = await sut.list();

      expect(
        doctors.map((doctor) => ({
          id: doctor.id,
          name: doctor.name,
          specialty: doctor.specialty,
          availableSlots: slotsOf(doctor),
        })),
      ).toEqual([
        {
          id: 2,
          name: 'Dra. Maria Souza',
          specialty: 'Dermatologista',
          availableSlots: ['2026-06-11 14:00', '2026-06-11 15:00'],
        },
      ]);
    });

    it('mantém na lista, com horários vazios, o médico sem horários livres', async () => {
      const fullyBooked = aDoctorSchedule()
        .withId(3)
        .withSlots(['2026-06-12 08:00'])
        .withReservedSlots(['2026-06-12 08:00'])
        .build();
      const sut = makeSut([fullyBooked]);

      const doctor = await findDoctor(sut, 3);

      expect(doctor).toBeDefined();
      expect(slotsOf(doctor)).toEqual([]);
    });

    it('devolve um novo array a cada chamada', async () => {
      const sut = makeSut();

      const first = await sut.list();
      const second = await sut.list();

      expect(second).not.toBe(first);
    });

    it('não altera uma lista já devolvida quando uma reserva acontece depois', async () => {
      const sut = makeSut();
      const before = await sut.list();

      await sut.reserveSlot(1, slot('2026-06-10 09:00'));

      expect(slotsOf(before.find((doctor) => doctor.id === 1))).toEqual([
        '2026-06-10 09:00',
        '2026-06-10 10:00',
        '2026-06-10 11:00',
      ]);
    });
  });

  describe('reserveSlot', () => {
    it('reserva o horário e devolve o médico já sem ele', async () => {
      const sut = makeSut();

      const result = await sut.reserveSlot(1, slot('2026-06-10 09:00'));

      const doctor = expectOk(result);
      expect(doctor.id).toBe(1);
      expect(doctor.name).toBe('Dr. João Silva');
      expect(slotsOf(doctor)).toEqual(['2026-06-10 10:00', '2026-06-10 11:00']);
    });

    it('faz o horário reservado sumir da listagem', async () => {
      const sut = makeSut();

      await sut.reserveSlot(1, slot('2026-06-10 10:00'));

      expect(slotsOf(await findDoctor(sut, 1))).toEqual(['2026-06-10 09:00', '2026-06-10 11:00']);
    });

    it('retorna DoctorNotFoundError quando o médico não existe', async () => {
      const sut = makeSut();

      const result = await sut.reserveSlot(99, slot('2026-06-10 09:00'));

      const error = expectErr(result);
      expect(error).toBeInstanceOf(DoctorNotFoundError);
      expect(error.code).toBe('DOCTOR_NOT_FOUND');
    });

    it('retorna SlotNotOfferedError quando o horário nunca fez parte da agenda do médico', async () => {
      const sut = makeSut();

      const result = await sut.reserveSlot(1, slot('2026-06-10 15:00'));

      const error = expectErr(result);
      expect(error).toBeInstanceOf(SlotNotOfferedError);
      expect(error.code).toBe('SLOT_NOT_OFFERED');
    });

    it('retorna SlotUnavailableError ao reservar duas vezes o mesmo horário', async () => {
      const sut = makeSut();
      await sut.reserveSlot(1, slot('2026-06-10 09:00'));

      const result = await sut.reserveSlot(1, slot('2026-06-10 09:00'));

      const error = expectErr(result);
      expect(error).toBeInstanceOf(SlotUnavailableError);
      expect(error.code).toBe('SLOT_UNAVAILABLE');
    });

    it('não altera a agenda de outros médicos', async () => {
      const sut = makeSut();

      await sut.reserveSlot(1, slot('2026-06-10 09:00'));

      expect(slotsOf(await findDoctor(sut, 2))).toEqual(['2026-06-11 14:00', '2026-06-11 15:00']);
    });
  });

  describe('isolamento e atomicidade', () => {
    it('não muta o array recebido no construtor', async () => {
      const schedules = [drJoao(), draMaria()];
      const [joaoBefore, mariaBefore] = schedules;
      const sut = makeSut(schedules);

      await sut.reserveSlot(1, slot('2026-06-10 09:00'));

      expect(schedules).toHaveLength(2);
      expect(schedules[0]).toBe(joaoBefore);
      expect(schedules[1]).toBe(mariaBefore);
      expect(slotsOf(schedules[0]?.toDoctor())).toEqual([
        '2026-06-10 09:00',
        '2026-06-10 10:00',
        '2026-06-10 11:00',
      ]);
    });

    it('não muta DOCTORS_SEED ao reservar', async () => {
      const snapshot = structuredClone(DOCTORS_SEED);
      const sut = new InMemoryScheduleRepository(createDoctorSchedules(DOCTORS_SEED));

      await sut.reserveSlot(1, slot('2026-06-10 09:00'));

      expect(DOCTORS_SEED).toEqual(snapshot);
    });

    it('instâncias diferentes não compartilham estado', async () => {
      const schedules = [drJoao()];
      const first = makeSut(schedules);
      const second = makeSut(schedules);

      await first.reserveSlot(1, slot('2026-06-10 09:00'));

      expect(slotsOf(await findDoctor(second, 1))).toContain('2026-06-10 09:00');
    });

    it('em reservas concorrentes do mesmo horário, exatamente uma vence e a outra recebe SlotUnavailableError', async () => {
      const sut = makeSut();

      const results = await Promise.all([
        sut.reserveSlot(1, slot('2026-06-10 09:00')),
        sut.reserveSlot(1, slot('2026-06-10 09:00')),
      ]);

      const successes = results.filter((result) => result.ok);
      const failures = results.flatMap((result) => (result.ok ? [] : [result.error]));
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toBeInstanceOf(SlotUnavailableError);
    });

    it('em reservas concorrentes de horários diferentes do mesmo médico, ambas vencem e os dois horários somem', async () => {
      const sut = makeSut();

      const results = await Promise.all([
        sut.reserveSlot(1, slot('2026-06-10 09:00')),
        sut.reserveSlot(1, slot('2026-06-10 11:00')),
      ]);

      expect(results.every((result) => result.ok)).toBe(true);
      expect(slotsOf(await findDoctor(sut, 1))).toEqual(['2026-06-10 10:00']);
    });
  });
});
