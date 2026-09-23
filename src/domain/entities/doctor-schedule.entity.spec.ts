import { aDoctorSchedule } from '../../../tests/helpers/builders/doctor-schedule.builder';
import { slot } from '../../../tests/helpers/builders/slot';
import { expectErr, expectOk } from '../../../tests/helpers/result-assertions';
import { DuplicateSlotError } from '../errors/duplicate-slot.error';
import { SlotNotOfferedError } from '../errors/slot-not-offered.error';
import { SlotUnavailableError } from '../errors/slot-unavailable.error';
import type { Doctor } from './doctor.entity';
import { DoctorSchedule } from './doctor-schedule.entity';

function availableSlotsOf(doctor: Doctor): ReadonlyArray<string> {
  return doctor.availableSlots.map((available) => available.toString());
}

describe('DoctorSchedule', () => {
  describe('create', () => {
    it('cria a agenda quando os horários ofertados são distintos', () => {
      const result = DoctorSchedule.create({
        doctorId: 1,
        doctorName: 'Dr. João Silva',
        specialty: 'Cardiologista',
        offeredSlots: [slot('2026-06-10 09:00'), slot('2026-06-10 10:00')],
      });

      const schedule = expectOk(result);

      expect(availableSlotsOf(schedule.toDoctor())).toEqual([
        '2026-06-10 09:00',
        '2026-06-10 10:00',
      ]);
    });

    it('retorna DuplicateSlotError quando um horário é ofertado mais de uma vez', () => {
      const result = DoctorSchedule.create({
        doctorId: 42,
        doctorName: 'Dr. João Silva',
        specialty: 'Cardiologista',
        offeredSlots: [
          slot('2026-06-10 09:00'),
          slot('2026-06-10 10:00'),
          slot('2026-06-10 09:00'),
        ],
      });

      const error = expectErr(result);

      expect(error).toBeInstanceOf(DuplicateSlotError);
      expect(error).toMatchObject({ doctorId: 42, slot: slot('2026-06-10 09:00') });
    });
  });

  describe('doctorId', () => {
    it('expõe o id do médico', () => {
      const schedule = aDoctorSchedule().withId(7).build();

      expect(schedule.doctorId).toBe(7);
    });
  });

  describe('toDoctor', () => {
    it('expõe id, nome, especialidade e todos os horários ofertados quando nada foi reservado', () => {
      const schedule = expectOk(
        DoctorSchedule.create({
          doctorId: 1,
          doctorName: 'Dr. João Silva',
          specialty: 'Cardiologista',
          offeredSlots: [slot('2026-06-10 09:00'), slot('2026-06-10 10:00')],
        }),
      );

      const doctor = schedule.toDoctor();

      expect(doctor.id).toBe(1);
      expect(doctor.name).toBe('Dr. João Silva');
      expect(doctor.specialty).toBe('Cardiologista');
      expect(availableSlotsOf(doctor)).toEqual(['2026-06-10 09:00', '2026-06-10 10:00']);
    });

    it('preserva a ordem do seed, sem ordenar (D23)', () => {
      const schedule = aDoctorSchedule()
        .withSlots(['2026-06-10 11:00', '2026-06-10 09:00', '2026-06-10 10:00'])
        .build();

      const doctor = schedule.toDoctor();

      expect(availableSlotsOf(doctor)).toEqual([
        '2026-06-10 11:00',
        '2026-06-10 09:00',
        '2026-06-10 10:00',
      ]);
    });

    it('devolve lista vazia de horários quando todos foram reservados, mantendo o médico (D21)', () => {
      const schedule = aDoctorSchedule()
        .withSlots(['2026-06-10 09:00', '2026-06-10 10:00'])
        .withReservedSlots(['2026-06-10 09:00', '2026-06-10 10:00'])
        .build();

      const doctor = schedule.toDoctor();

      expect(doctor.id).toBe(1);
      expect(doctor.availableSlots).toEqual([]);
    });
  });

  describe('reserve', () => {
    it('devolve nova agenda sem o horário reservado entre os disponíveis', () => {
      const schedule = aDoctorSchedule()
        .withSlots(['2026-06-10 09:00', '2026-06-10 10:00', '2026-06-10 11:00'])
        .build();

      const reserved = expectOk(schedule.reserve(slot('2026-06-10 10:00')));

      expect(availableSlotsOf(reserved.toDoctor())).toEqual([
        '2026-06-10 09:00',
        '2026-06-10 11:00',
      ]);
    });

    it('não altera a agenda original (imutável)', () => {
      const schedule = aDoctorSchedule()
        .withSlots(['2026-06-10 09:00', '2026-06-10 10:00'])
        .build();

      const reserved = expectOk(schedule.reserve(slot('2026-06-10 09:00')));

      expect(reserved).not.toBe(schedule);
      expect(availableSlotsOf(schedule.toDoctor())).toEqual([
        '2026-06-10 09:00',
        '2026-06-10 10:00',
      ]);
    });

    it('acumula reservas sucessivas', () => {
      const schedule = aDoctorSchedule()
        .withSlots(['2026-06-10 09:00', '2026-06-10 10:00', '2026-06-10 11:00'])
        .build();

      const first = expectOk(schedule.reserve(slot('2026-06-10 09:00')));
      const second = expectOk(first.reserve(slot('2026-06-10 11:00')));

      expect(availableSlotsOf(second.toDoctor())).toEqual(['2026-06-10 10:00']);
    });

    it('mantém o id do médico na nova agenda', () => {
      const schedule = aDoctorSchedule().withId(2).withSlots(['2026-06-11 14:00']).build();

      const reserved = expectOk(schedule.reserve(slot('2026-06-11 14:00')));

      expect(reserved.doctorId).toBe(2);
    });

    it('retorna SlotNotOfferedError com doctorId e slot quando o horário nunca foi ofertado (422)', () => {
      const schedule = aDoctorSchedule().withId(1).withSlots(['2026-06-10 09:00']).build();
      const notOffered = slot('2026-06-10 15:00');

      const error = expectErr(schedule.reserve(notOffered));

      expect(error).toBeInstanceOf(SlotNotOfferedError);
      expect(error.doctorId).toBe(1);
      expect(error.slot.equals(notOffered)).toBe(true);
    });

    it('retorna SlotUnavailableError com doctorId e slot quando o horário já foi reservado (409)', () => {
      const schedule = aDoctorSchedule().withId(1).withSlots(['2026-06-10 09:00']).build();
      const reserved = expectOk(schedule.reserve(slot('2026-06-10 09:00')));

      const error = expectErr(reserved.reserve(slot('2026-06-10 09:00')));

      expect(error).toBeInstanceOf(SlotUnavailableError);
      expect(error.doctorId).toBe(1);
      expect(error.slot.toString()).toBe('2026-06-10 09:00');
    });
  });
});
