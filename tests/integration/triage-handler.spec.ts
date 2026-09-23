import type { APIGatewayProxyResult } from 'aws-lambda';

import { TriageInvalidResponseError } from '../../src/application/errors/triage-invalid-response.error';
import { TriageTimeoutError } from '../../src/application/errors/triage-timeout.error';
import type { TriageModel } from '../../src/application/ports/triage-model.port';
import { createScheduleHandler } from '../../src/interfaces/http/handlers/schedule-handler.factory';
import type { ContainerOptions } from '../../src/main/container';
import { createContainer } from '../../src/main/container';
import { aJsonPostEvent, anApiGatewayEvent } from '../helpers/api-gateway-event';
import { anAppointmentPayload } from '../helpers/builders/appointment-payload';
import type { LogCapture } from '../helpers/fakes/log-capture';
import { captureLogs } from '../helpers/fakes/log-capture';
import { SequentialIdGenerator } from '../helpers/fakes/sequential-id.generator';
import { StubTriageModel, aTriageClassification } from '../helpers/fakes/stub-triage.model';
import { parseJsonBody } from '../helpers/json-body';

/*
 * Os literais abaixo são o contrato de docs/requisitos.md (contrato 3) e da spec aprovada da
 * Fase 5. De propósito, nada é importado de `error-messages.ts` nem do caso de uso: o teste prova
 * o contrato, não a constante.
 */
const JSON_CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
};

const CONTRACT_SYMPTOMS = 'Sinto dor no peito ao subir escadas e palpitações';

const AVISO =
  'Esta é uma sugestão automatizada e não substitui avaliação médica. Em caso de emergência, ligue 192.';

const CONTRACT_TRIAGE = {
  especialidade_sugerida: 'Cardiologista',
  urgencia: 'media',
  justificativa: 'Dor no peito aos esforços e palpitações sugerem avaliação cardiológica.',
  medicos_disponiveis: [{ id: 1, nome: 'Dr. João Silva', proximo_horario: '2026-06-10 09:00' }],
  aviso: AVISO,
};

const TRIAGE_UNAVAILABLE = {
  erro: 'Triagem indisponível',
  mensagem:
    'O serviço de triagem está temporariamente indisponível. Tente novamente mais tarde. Em caso de emergência, ligue 192.',
};

const TRIAGE_INVALID_RESPONSE = {
  erro: 'Resposta inválida da triagem',
  mensagem:
    'Não foi possível interpretar a sugestão da triagem. Tente novamente. Em caso de emergência, ligue 192.',
};

const TRIAGE_TIMEOUT = {
  erro: 'Tempo esgotado na triagem',
  mensagem:
    'A triagem demorou mais que o esperado. Tente novamente. Em caso de emergência, ligue 192.',
};

function invalidPayload(campo: string, problema: string): unknown {
  return {
    erro: 'Payload inválido',
    mensagem: 'O corpo da requisição é inválido. Verifique os detalhes.',
    detalhes: [{ campo, problema }],
  };
}

type ScheduleHandler = ReturnType<typeof createScheduleHandler>;

/**
 * Container novo por teste (estado isolado). Por padrão usa o provider `fake` via `env`, como o
 * `.env.example`; `triageModel` substitui o modelo inteiro quando o teste precisa de um desfecho
 * específico (504, 502, emergência).
 */
function makeSut(options: Partial<Pick<ContainerOptions, 'env' | 'triageModel'>> = {}): {
  handler: ScheduleHandler;
  logs: LogCapture;
} {
  const logs = captureLogs();
  const handler = createScheduleHandler(
    createContainer({
      idGenerator: new SequentialIdGenerator(),
      logWriter: logs.write,
      env: options.env ?? { TRIAGE_PROVIDER: 'fake' },
      ...(options.triageModel === undefined ? {} : { triageModel: options.triageModel }),
    }),
  );
  return { handler, logs };
}

function withTriageModel(triageModel: TriageModel): ReturnType<typeof makeSut> {
  return makeSut({ triageModel });
}

function postTriage(
  handler: ScheduleHandler,
  payload: unknown = { sintomas: CONTRACT_SYMPTOMS },
): Promise<APIGatewayProxyResult> {
  return handler(aJsonPostEvent('/triagem', payload));
}

function postRawTriageBody(
  handler: ScheduleHandler,
  body: string | null,
): Promise<APIGatewayProxyResult> {
  return handler(
    anApiGatewayEvent({
      method: 'POST',
      resource: '/triagem',
      body,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function getSchedules(handler: ScheduleHandler): Promise<APIGatewayProxyResult> {
  return handler(anApiGatewayEvent({ method: 'GET', resource: '/agendas' }));
}

describe('schedule handler — POST /triagem', () => {
  describe('sucesso (provider fake)', () => {
    it('responde 200 com o corpo exato do contrato 3 para o caso do enunciado', async () => {
      const { handler } = makeSut();

      const result = await postTriage(handler);

      expect(result.statusCode).toBe(200);
      expect(parseJsonBody(result)).toEqual(CONTRACT_TRIAGE);
    });

    it('aceita JSON válido sem header Content-Type (D24)', async () => {
      const { handler } = makeSut();

      const result = await handler(
        aJsonPostEvent('/triagem', { sintomas: CONTRACT_SYMPTOMS }, { headers: {} }),
      );

      expect(result.statusCode).toBe(200);
      expect(parseJsonBody(result)).toEqual(CONTRACT_TRIAGE);
    });

    it('ignora espaços nas pontas dos sintomas', async () => {
      const { handler } = makeSut();

      const result = await postTriage(handler, { sintomas: `   ${CONTRACT_SYMPTOMS}   ` });

      expect(result.statusCode).toBe(200);
      expect(parseJsonBody(result)).toEqual(CONTRACT_TRIAGE);
    });
  });

  describe('cruzamento com a agenda', () => {
    it('sugere o próximo horário livre depois que o horário das 09:00 é agendado', async () => {
      const { handler } = makeSut();
      await handler(aJsonPostEvent('/agendamento', anAppointmentPayload()));

      const result = await postTriage(handler);

      expect(result.statusCode).toBe(200);
      expect(parseJsonBody(result)).toEqual({
        ...CONTRACT_TRIAGE,
        medicos_disponiveis: [
          { id: 1, nome: 'Dr. João Silva', proximo_horario: '2026-06-10 10:00' },
        ],
      });
    });

    it('agendar o horário sugerido pela triagem funciona e a triagem seguinte já sugere outro horário', async () => {
      const { handler } = makeSut();
      const first = await postTriage(handler);

      const booked = await handler(
        aJsonPostEvent(
          '/agendamento',
          anAppointmentPayload({ medico_id: 1, data_horario: '2026-06-10 09:00' }),
        ),
      );
      const second = await postTriage(handler);

      expect(parseJsonBody(first)).toEqual(CONTRACT_TRIAGE);
      expect(booked.statusCode).toBe(201);
      expect(parseJsonBody(second)).toMatchObject({
        medicos_disponiveis: [{ id: 1, proximo_horario: '2026-06-10 10:00' }],
      });
    });

    it('devolve medicos_disponiveis vazio quando o médico da especialidade não tem horário livre', async () => {
      const { handler } = makeSut();
      for (const data_horario of ['2026-06-10 09:00', '2026-06-10 10:00', '2026-06-10 11:00']) {
        await handler(aJsonPostEvent('/agendamento', anAppointmentPayload({ data_horario })));
      }

      const result = await postTriage(handler);

      expect(result.statusCode).toBe(200);
      expect(parseJsonBody(result)).toEqual({ ...CONTRACT_TRIAGE, medicos_disponiveis: [] });
    });
  });

  describe('emergência', () => {
    it('orienta procurar pronto-socorro ou ligar 192 na justificativa e mantém médicos e aviso', async () => {
      const { handler } = withTriageModel(
        StubTriageModel.returning(
          aTriageClassification({
            specialty: 'Clínico Geral',
            urgency: 'emergencia',
            rationale: 'Perda súbita de força e fala enrolada são sinais de AVC.',
          }),
        ),
      );

      const result = await postTriage(handler, {
        sintomas: 'Meu pai perdeu a força do lado direito e está com a fala enrolada',
      });

      expect(result.statusCode).toBe(200);
      expect(parseJsonBody(result)).toEqual({
        especialidade_sugerida: 'Clínico Geral',
        urgencia: 'emergencia',
        justificativa:
          'Procure imediatamente um pronto-socorro ou ligue 192 (SAMU). Perda súbita de força e fala enrolada são sinais de AVC.',
        medicos_disponiveis: [
          { id: 5, nome: 'Dra. Fernanda Costa', proximo_horario: '2026-06-16 08:00' },
        ],
        aviso: AVISO,
      });
    });
  });

  describe('payload inválido (400, D8)', () => {
    it('responde 400 para JSON malformado', async () => {
      const { handler } = makeSut();

      const result = await postRawTriageBody(handler, '{"sintomas": "dor no peito');

      expect(result.statusCode).toBe(400);
      expect(parseJsonBody(result)).toEqual(invalidPayload('corpo', 'deve ser um JSON válido'));
    });

    it.each([
      ['ausente', null],
      ['vazio', ''],
    ])('responde 400 para body %s', async (_label, body) => {
      const { handler } = makeSut();

      const result = await postRawTriageBody(handler, body);

      expect(result.statusCode).toBe(400);
      expect(parseJsonBody(result)).toEqual(invalidPayload('corpo', 'é obrigatório'));
    });

    it('responde 400 para objeto JSON vazio, apontando sintomas', async () => {
      const { handler } = makeSut();

      const result = await postTriage(handler, {});

      expect(result.statusCode).toBe(400);
      expect(parseJsonBody(result)).toEqual(invalidPayload('sintomas', 'é obrigatório'));
    });

    it('responde 400 para sintomas com menos de 10 caracteres', async () => {
      const { handler } = makeSut();

      const result = await postTriage(handler, { sintomas: 'dor fort' });

      expect(result.statusCode).toBe(400);
      expect(parseJsonBody(result)).toEqual(
        invalidPayload('sintomas', 'deve ter pelo menos 10 caracteres'),
      );
    });

    it('responde 400 para sintomas com mais de 2000 caracteres', async () => {
      const { handler } = makeSut();

      const result = await postTriage(handler, { sintomas: 'a'.repeat(2001) });

      expect(result.statusCode).toBe(400);
      expect(parseJsonBody(result)).toEqual(
        invalidPayload('sintomas', 'deve ter no máximo 2000 caracteres'),
      );
    });

    it('responde 400 para sintomas que não são texto', async () => {
      const { handler } = makeSut();

      const result = await postTriage(handler, { sintomas: 12345678901 });

      expect(result.statusCode).toBe(400);
      expect(parseJsonBody(result)).toEqual(invalidPayload('sintomas', 'deve ser um texto'));
    });

    it('não consulta o modelo quando o payload é inválido', async () => {
      const triageModel = StubTriageModel.returning();
      const { handler } = withTriageModel(triageModel);

      await postTriage(handler, { sintomas: 'curto' });

      expect(triageModel.requests).toEqual([]);
    });
  });

  describe('falhas da triagem', () => {
    it('responde 503 com o corpo literal quando o provider é anthropic e não há chave (D17)', async () => {
      const { handler } = makeSut({ env: { TRIAGE_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: '' } });

      const result = await postTriage(handler);

      expect(result.statusCode).toBe(503);
      expect(parseJsonBody(result)).toEqual(TRIAGE_UNAVAILABLE);
    });

    it('mantém GET /agendas respondendo 200 no mesmo container sem chave da Anthropic', async () => {
      const { handler } = makeSut({ env: { TRIAGE_PROVIDER: 'anthropic' } });
      await postTriage(handler);

      const result = await getSchedules(handler);

      expect(result.statusCode).toBe(200);
      expect(parseJsonBody(result)).toHaveProperty(['medicos', 0, 'nome'], 'Dr. João Silva');
    });

    it('responde 504 com o corpo literal quando o modelo estoura o tempo', async () => {
      const { handler } = withTriageModel(
        StubTriageModel.failingWith(new TriageTimeoutError(5_000)),
      );

      const result = await postTriage(handler);

      expect(result.statusCode).toBe(504);
      expect(parseJsonBody(result)).toEqual(TRIAGE_TIMEOUT);
    });

    it('responde 502 com o corpo literal quando a resposta do modelo é inválida', async () => {
      const { handler } = withTriageModel(
        StubTriageModel.failingWith(new TriageInvalidResponseError(2)),
      );

      const result = await postTriage(handler);

      expect(result.statusCode).toBe(502);
      expect(parseJsonBody(result)).toEqual(TRIAGE_INVALID_RESPONSE);
    });
  });

  describe('logs', () => {
    it.each<[string, () => ReturnType<typeof makeSut>, unknown]>([
      ['sucesso', () => makeSut(), { sintomas: CONTRACT_SYMPTOMS }],
      [
        'triagem indisponível (503)',
        () => makeSut({ env: { TRIAGE_PROVIDER: 'anthropic' } }),
        { sintomas: CONTRACT_SYMPTOMS },
      ],
      [
        'tempo esgotado (504)',
        () => withTriageModel(StubTriageModel.failingWith(new TriageTimeoutError(5_000))),
        { sintomas: CONTRACT_SYMPTOMS },
      ],
      [
        'payload inválido (400)',
        () => makeSut(),
        { sintomas: `${CONTRACT_SYMPTOMS} ${'a'.repeat(2000)}` },
      ],
    ])('nenhuma linha de log contém os sintomas (%s)', async (_label, createSut, payload) => {
      const { handler, logs } = createSut();

      await postTriage(handler, payload);

      expect(logs.entries.length).toBeGreaterThan(0);
      expect(logs.text).not.toContain(CONTRACT_SYMPTOMS);
      expect(logs.text).not.toContain('palpitações');
    });
  });

  describe('CORS (D19)', () => {
    it.each<[string, () => ReturnType<typeof makeSut>, unknown]>([
      ['200', () => makeSut(), { sintomas: CONTRACT_SYMPTOMS }],
      ['400', () => makeSut(), { sintomas: 'curto' }],
      [
        '502',
        () => withTriageModel(StubTriageModel.failingWith(new TriageInvalidResponseError(2))),
        { sintomas: CONTRACT_SYMPTOMS },
      ],
      [
        '503',
        () => makeSut({ env: { TRIAGE_PROVIDER: 'anthropic' } }),
        { sintomas: CONTRACT_SYMPTOMS },
      ],
      [
        '504',
        () => withTriageModel(StubTriageModel.failingWith(new TriageTimeoutError(5_000))),
        { sintomas: CONTRACT_SYMPTOMS },
      ],
    ])(
      'responde %s com Content-Type JSON e Access-Control-Allow-Origin',
      async (status, createSut, payload) => {
        const { handler } = createSut();

        const result = await postTriage(handler, payload);

        expect(String(result.statusCode)).toBe(status);
        expect(result.headers).toEqual(JSON_CORS_HEADERS);
      },
    );
  });
});
