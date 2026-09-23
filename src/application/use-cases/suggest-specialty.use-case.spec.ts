import { aDoctorSchedule } from '../../../tests/helpers/builders/doctor-schedule.builder';
import { slot } from '../../../tests/helpers/builders/slot';
import { FakeScheduleRepository } from '../../../tests/helpers/fakes/fake-schedule.repository';
import {
  StubTriageModel,
  aTriageClassification,
} from '../../../tests/helpers/fakes/stub-triage.model';
import { expectErr, expectOk } from '../../../tests/helpers/result-assertions';
import type { DoctorSchedule } from '../../domain/entities/doctor-schedule.entity';
import { SPECIALTIES } from '../../domain/value-objects/specialty.value-object';
import { TriageInvalidResponseError } from '../errors/triage-invalid-response.error';
import { TriageTimeoutError } from '../errors/triage-timeout.error';
import { TriageUnavailableError } from '../errors/triage-unavailable.error';
import type { TriageError } from '../ports/triage-model.port';
import type { AvailableDoctor } from './suggest-specialty.use-case';
import {
  EMERGENCY_GUIDANCE,
  SuggestSpecialtyUseCase,
  TRIAGE_DISCLAIMER,
} from './suggest-specialty.use-case';

const SYMPTOMS = 'Dor no peito ao subir escadas e palpitações há uma semana';

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
  triageModel: StubTriageModel = StubTriageModel.returning(),
  schedules: ReadonlyArray<DoctorSchedule> = [drJoao(), draMaria()],
): {
  sut: SuggestSpecialtyUseCase;
  triageModel: StubTriageModel;
  scheduleRepository: FakeScheduleRepository;
} {
  const scheduleRepository = new FakeScheduleRepository(schedules);
  const sut = new SuggestSpecialtyUseCase(triageModel, scheduleRepository);
  return { sut, triageModel, scheduleRepository };
}

function toPlain(doctor: AvailableDoctor): { id: number; name: string; nextSlot: string } {
  return { id: doctor.id, name: doctor.name, nextSlot: doctor.nextSlot.toString() };
}

describe('SuggestSpecialtyUseCase', () => {
  describe('sucesso', () => {
    it('retorna a especialidade, a urgência, a justificativa do modelo, os médicos disponíveis e o aviso', async () => {
      const { sut } = makeSut(
        StubTriageModel.returning(
          aTriageClassification({
            specialty: 'Cardiologista',
            urgency: 'media',
            rationale: 'Dor no peito aos esforços e palpitações sugerem avaliação cardiológica.',
          }),
        ),
      );

      const suggestion = expectOk(await sut.execute({ symptoms: SYMPTOMS }));

      expect(suggestion.specialty).toBe('Cardiologista');
      expect(suggestion.urgency).toBe('media');
      expect(suggestion.rationale).toBe(
        'Dor no peito aos esforços e palpitações sugerem avaliação cardiológica.',
      );
      expect(suggestion.availableDoctors.map(toPlain)).toEqual([
        { id: 1, name: 'Dr. João Silva', nextSlot: '2026-06-10 09:00' },
      ]);
      expect(suggestion.disclaimer).toBe(TRIAGE_DISCLAIMER);
    });

    it('envia ao modelo os sintomas e a lista fechada de especialidades', async () => {
      const { sut, triageModel } = makeSut();

      await sut.execute({ symptoms: SYMPTOMS });

      expect(triageModel.requests).toEqual([
        { symptoms: SYMPTOMS, allowedSpecialties: SPECIALTIES },
      ]);
    });

    it('usa o texto literal do aviso do contrato', () => {
      expect(TRIAGE_DISCLAIMER).toBe(
        'Esta é uma sugestão automatizada e não substitui avaliação médica. Em caso de emergência, ligue 192.',
      );
    });

    it.each(['baixa', 'media', 'alta', 'emergencia'] as const)(
      'inclui o aviso também quando a urgência é %s',
      async (urgency) => {
        const { sut } = makeSut(StubTriageModel.returning(aTriageClassification({ urgency })));

        const suggestion = expectOk(await sut.execute({ symptoms: SYMPTOMS }));

        expect(suggestion.disclaimer).toBe(TRIAGE_DISCLAIMER);
      },
    );
  });

  describe('emergência', () => {
    it('prefixa a justificativa com a orientação de procurar pronto-socorro ou ligar 192', async () => {
      const { sut } = makeSut(
        StubTriageModel.returning(
          aTriageClassification({
            specialty: 'Clínico Geral',
            urgency: 'emergencia',
            rationale: 'Perda súbita de força e fala enrolada são sinais de AVC.',
          }),
        ),
        [aDoctorSchedule().withId(5).withSpecialty('Clínico Geral').build()],
      );

      const suggestion = expectOk(await sut.execute({ symptoms: SYMPTOMS }));

      expect(suggestion.urgency).toBe('emergencia');
      expect(suggestion.rationale).toBe(
        'Procure imediatamente um pronto-socorro ou ligue 192 (SAMU). Perda súbita de força e fala enrolada são sinais de AVC.',
      );
    });

    it('usa o texto literal da orientação de emergência', () => {
      expect(EMERGENCY_GUIDANCE).toBe(
        'Procure imediatamente um pronto-socorro ou ligue 192 (SAMU).',
      );
    });

    it('mantém os médicos disponíveis da especialidade mesmo em emergência', async () => {
      const { sut } = makeSut(
        StubTriageModel.returning(
          aTriageClassification({ specialty: 'Cardiologista', urgency: 'emergencia' }),
        ),
      );

      const suggestion = expectOk(await sut.execute({ symptoms: SYMPTOMS }));

      expect(suggestion.availableDoctors.map(toPlain)).toEqual([
        { id: 1, name: 'Dr. João Silva', nextSlot: '2026-06-10 09:00' },
      ]);
    });

    it.each(['baixa', 'media', 'alta'] as const)(
      'não altera a justificativa quando a urgência é %s',
      async (urgency) => {
        const { sut } = makeSut(
          StubTriageModel.returning(aTriageClassification({ urgency, rationale: 'Motivo.' })),
        );

        const suggestion = expectOk(await sut.execute({ symptoms: SYMPTOMS }));

        expect(suggestion.rationale).toBe('Motivo.');
      },
    );
  });

  describe('médicos disponíveis (cruzamento com a agenda)', () => {
    it('lista só médicos da especialidade sugerida, na ordem do repositório', async () => {
      const { sut } = makeSut(
        StubTriageModel.returning(aTriageClassification({ specialty: 'Dermatologista' })),
        [
          drJoao(),
          aDoctorSchedule()
            .withId(7)
            .withName('Dr. Paulo Reis')
            .withSpecialty('Dermatologista')
            .withSlots(['2026-06-20 08:00'])
            .build(),
          draMaria(),
        ],
      );

      const suggestion = expectOk(await sut.execute({ symptoms: SYMPTOMS }));

      expect(suggestion.availableDoctors.map(toPlain)).toEqual([
        { id: 7, name: 'Dr. Paulo Reis', nextSlot: '2026-06-20 08:00' },
        { id: 2, name: 'Dra. Maria Souza', nextSlot: '2026-06-11 14:00' },
      ]);
    });

    it('omite médicos da especialidade sem nenhum horário livre', async () => {
      const { sut } = makeSut(StubTriageModel.returning(), [
        aDoctorSchedule()
          .withId(1)
          .withSpecialty('Cardiologista')
          .withSlots(['2026-06-10 09:00'])
          .withReservedSlots(['2026-06-10 09:00'])
          .build(),
        aDoctorSchedule()
          .withId(8)
          .withName('Dra. Clara Nunes')
          .withSpecialty('Cardiologista')
          .withSlots(['2026-06-18 16:00'])
          .build(),
      ]);

      const suggestion = expectOk(await sut.execute({ symptoms: SYMPTOMS }));

      expect(suggestion.availableDoctors.map(toPlain)).toEqual([
        { id: 8, name: 'Dra. Clara Nunes', nextSlot: '2026-06-18 16:00' },
      ]);
    });

    it('usa como próximo horário o mais cedo, mesmo com a agenda fora de ordem no seed', async () => {
      const { sut } = makeSut(StubTriageModel.returning(), [
        aDoctorSchedule()
          .withSpecialty('Cardiologista')
          .withSlots([
            '2026-06-12 08:00',
            '2026-06-10 11:00',
            '2026-06-10 10:30',
            '2026-06-11 07:00',
          ])
          .build(),
      ]);

      const suggestion = expectOk(await sut.execute({ symptoms: SYMPTOMS }));

      expect(suggestion.availableDoctors.map((doctor) => doctor.nextSlot.toString())).toEqual([
        '2026-06-10 10:30',
      ]);
    });

    it('não oferece como próximo horário um horário já reservado', async () => {
      const { sut, scheduleRepository } = makeSut();
      await scheduleRepository.reserveSlot(1, slot('2026-06-10 09:00'));

      const suggestion = expectOk(await sut.execute({ symptoms: SYMPTOMS }));

      expect(suggestion.availableDoctors.map(toPlain)).toEqual([
        { id: 1, name: 'Dr. João Silva', nextSlot: '2026-06-10 10:00' },
      ]);
    });

    it('devolve lista vazia quando nenhum médico da especialidade tem horário livre', async () => {
      const { sut } = makeSut(
        StubTriageModel.returning(aTriageClassification({ specialty: 'Pediatra' })),
      );

      const suggestion = expectOk(await sut.execute({ symptoms: SYMPTOMS }));

      expect(suggestion.specialty).toBe('Pediatra');
      expect(suggestion.availableDoctors).toEqual([]);
    });
  });

  describe('falhas do modelo', () => {
    it.each<[string, () => TriageError]>([
      ['TriageUnavailableError', () => new TriageUnavailableError('missing_api_key')],
      ['TriageTimeoutError', () => new TriageTimeoutError(5_000)],
      ['TriageInvalidResponseError', () => new TriageInvalidResponseError(2)],
    ])('propaga %s sem consultar a agenda', async (_label, createError) => {
      const failure = createError();
      const { sut, scheduleRepository } = makeSut(StubTriageModel.failingWith(failure));

      const error = expectErr(await sut.execute({ symptoms: SYMPTOMS }));

      expect(error).toBe(failure);
      expect(scheduleRepository.listCalls).toBe(0);
    });
  });
});
