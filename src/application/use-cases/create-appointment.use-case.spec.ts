import { aDoctorSchedule } from '../../../tests/helpers/builders/doctor-schedule.builder';
import { slot } from '../../../tests/helpers/builders/slot';
import type { FakeAppointmentRepositoryOptions } from '../../../tests/helpers/fakes/fake-appointment.repository';
import { FakeAppointmentRepository } from '../../../tests/helpers/fakes/fake-appointment.repository';
import { FakeScheduleRepository } from '../../../tests/helpers/fakes/fake-schedule.repository';
import { SequentialIdGenerator } from '../../../tests/helpers/fakes/sequential-id.generator';
import { expectErr, expectOk } from '../../../tests/helpers/result-assertions';
import type { DoctorSchedule } from '../../domain/entities/doctor-schedule.entity';
import { DoctorNotFoundError } from '../../domain/errors/doctor-not-found.error';
import { SlotNotOfferedError } from '../../domain/errors/slot-not-offered.error';
import { SlotUnavailableError } from '../../domain/errors/slot-unavailable.error';
import type { CreateAppointmentError, CreateAppointmentInput } from './create-appointment.use-case';
import { CreateAppointmentUseCase } from './create-appointment.use-case';
import { ListSchedulesUseCase } from './list-schedules.use-case';

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
  appointmentOptions: FakeAppointmentRepositoryOptions = {},
): {
  sut: CreateAppointmentUseCase;
  scheduleRepository: FakeScheduleRepository;
  appointmentRepository: FakeAppointmentRepository;
  idGenerator: SequentialIdGenerator;
} {
  const scheduleRepository = new FakeScheduleRepository(schedules);
  const appointmentRepository = new FakeAppointmentRepository(appointmentOptions);
  const idGenerator = new SequentialIdGenerator();
  const sut = new CreateAppointmentUseCase(scheduleRepository, appointmentRepository, idGenerator);
  return { sut, scheduleRepository, appointmentRepository, idGenerator };
}

function anInput(
  overrides: Partial<{ doctorId: number; patient: string; slot: string }> = {},
): CreateAppointmentInput {
  return {
    doctorId: overrides.doctorId ?? 1,
    patient: overrides.patient ?? 'Carlos Almeida',
    slot: slot(overrides.slot ?? '2026-06-10 09:00'),
  };
}

describe('CreateAppointmentUseCase', () => {
  describe('sucesso', () => {
    it('retorna Appointment com id gerado, doctorId, doctorName, patient e slot', async () => {
      const { sut } = makeSut();

      const appointment = expectOk(await sut.execute(anInput()));

      expect(appointment.id).toBe('appointment-1');
      expect(appointment.doctorId).toBe(1);
      expect(appointment.doctorName).toBe('Dr. João Silva');
      expect(appointment.patient).toBe('Carlos Almeida');
      expect(appointment.slot.toString()).toBe('2026-06-10 09:00');
    });

    it('persiste o agendamento no AppointmentRepository', async () => {
      const { sut, appointmentRepository } = makeSut();

      const appointment = expectOk(await sut.execute(anInput()));

      expect(appointmentRepository.saved).toEqual([appointment]);
    });

    it('o horário some de availableSlots na listagem seguinte (D6)', async () => {
      const { sut, scheduleRepository } = makeSut();
      const listSchedules = new ListSchedulesUseCase(scheduleRepository);

      await sut.execute(anInput({ doctorId: 1, slot: '2026-06-10 09:00' }));
      const doctors = await listSchedules.execute();

      const joao = doctors.find((doctor) => doctor.id === 1);
      expect(joao?.availableSlots.map((available) => available.toString())).toEqual([
        '2026-06-10 10:00',
        '2026-06-10 11:00',
      ]);
    });

    it('não altera a agenda de outros médicos', async () => {
      const { sut, scheduleRepository } = makeSut();

      await sut.execute(anInput({ doctorId: 1, slot: '2026-06-10 09:00' }));
      const doctors = await scheduleRepository.list();

      const maria = doctors.find((doctor) => doctor.id === 2);
      expect(maria?.availableSlots.map((available) => available.toString())).toEqual([
        '2026-06-11 14:00',
        '2026-06-11 15:00',
      ]);
    });
  });

  describe('erros de negócio', () => {
    it('retorna DoctorNotFoundError com o doctorId quando o médico não existe', async () => {
      const { sut } = makeSut();

      const error = expectErr(await sut.execute(anInput({ doctorId: 99 })));

      expect(error).toBeInstanceOf(DoctorNotFoundError);
      expect(error).toMatchObject({ code: 'DOCTOR_NOT_FOUND', doctorId: 99 });
    });

    it('retorna SlotNotOfferedError quando o horário nunca foi ofertado pelo médico', async () => {
      const { sut } = makeSut();

      const error = expectErr(
        await sut.execute(anInput({ doctorId: 1, slot: '2026-06-10 15:00' })),
      );

      expect(error).toBeInstanceOf(SlotNotOfferedError);
      expect(error).toMatchObject({ code: 'SLOT_NOT_OFFERED', doctorId: 1 });
    });

    it('retorna SlotUnavailableError quando o horário já foi reservado', async () => {
      const { sut } = makeSut();
      await sut.execute(anInput({ patient: 'Ana Paula', slot: '2026-06-10 09:00' }));

      const error = expectErr(
        await sut.execute(anInput({ patient: 'Bruno Lima', slot: '2026-06-10 09:00' })),
      );

      expect(error).toBeInstanceOf(SlotUnavailableError);
      expect(error).toMatchObject({ code: 'SLOT_UNAVAILABLE', doctorId: 1 });
    });

    it('delega a atomicidade ao repositório: em reservas concorrentes do mesmo horário só uma tem sucesso', async () => {
      const { sut, appointmentRepository } = makeSut();

      const results = await Promise.all([
        sut.execute(anInput({ patient: 'Ana Paula', slot: '2026-06-10 09:00' })),
        sut.execute(anInput({ patient: 'Bruno Lima', slot: '2026-06-10 09:00' })),
      ]);

      const successes = results.filter((result) => result.ok);
      const failures = results.flatMap((result) => (result.ok ? [] : [result.error]));
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toBeInstanceOf(SlotUnavailableError);
      expect(appointmentRepository.saved).toHaveLength(1);
    });

    it('resolve com err, sem lançar, em erro de negócio', async () => {
      const { sut } = makeSut();

      await expect(sut.execute(anInput({ doctorId: 99 }))).resolves.toMatchObject({ ok: false });
    });
  });

  describe('atomicidade e efeitos colaterais', () => {
    it('chama reserveSlot uma única vez, sem consultar list antes (sem check-then-act, D14)', async () => {
      const { sut, scheduleRepository } = makeSut();

      await sut.execute(anInput({ doctorId: 1, slot: '2026-06-10 09:00' }));

      expect(scheduleRepository.listCalls).toBe(0);
      expect(scheduleRepository.reserveSlotCalls).toHaveLength(1);
      expect(scheduleRepository.reserveSlotCalls[0]?.doctorId).toBe(1);
      expect(scheduleRepository.reserveSlotCalls[0]?.slot.toString()).toBe('2026-06-10 09:00');
    });

    interface FailedReservationCase {
      readonly description: string;
      readonly schedules: () => ReadonlyArray<DoctorSchedule>;
      readonly input: () => CreateAppointmentInput;
      readonly expectedError: abstract new (...args: never[]) => CreateAppointmentError;
    }

    const failedReservationCases: ReadonlyArray<FailedReservationCase> = [
      {
        description: 'médico inexistente',
        schedules: () => [drJoao()],
        input: () => anInput({ doctorId: 99 }),
        expectedError: DoctorNotFoundError,
      },
      {
        description: 'horário não ofertado',
        schedules: () => [drJoao()],
        input: () => anInput({ doctorId: 1, slot: '2026-06-10 15:00' }),
        expectedError: SlotNotOfferedError,
      },
      {
        description: 'horário já reservado',
        schedules: () => [
          aDoctorSchedule()
            .withId(1)
            .withSlots(['2026-06-10 09:00'])
            .withReservedSlots(['2026-06-10 09:00'])
            .build(),
        ],
        input: () => anInput({ doctorId: 1, slot: '2026-06-10 09:00' }),
        expectedError: SlotUnavailableError,
      },
    ];

    it.each(failedReservationCases)(
      'não gera id nem persiste quando a reserva falha ($description)',
      async ({ schedules, input, expectedError }) => {
        const { sut, appointmentRepository, idGenerator } = makeSut(schedules());

        const error = expectErr(await sut.execute(input()));

        expect(error).toBeInstanceOf(expectedError);
        expect(idGenerator.calls).toBe(0);
        expect(appointmentRepository.saved).toEqual([]);
      },
    );
  });

  describe('falhas inesperadas', () => {
    it('rejeita a Promise quando o repositório falha inesperadamente', async () => {
      const { sut } = makeSut([drJoao()], { failWith: new Error('falha de infraestrutura') });

      await expect(sut.execute(anInput())).rejects.toThrow('falha de infraestrutura');
    });
  });
});
