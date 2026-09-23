import type { APIGatewayProxyResult } from 'aws-lambda';

import type { IdGenerator } from '../../src/application/ports/id-generator.port';
import { createScheduleHandler } from '../../src/interfaces/http/handlers/schedule-handler';
import { createContainer } from '../../src/main/container';
import { aJsonPostEvent, anApiGatewayEvent } from '../helpers/api-gateway-event';
import { anAppointmentPayload } from '../helpers/builders/appointment-payload';
import type { LogCapture } from '../helpers/fakes/log-capture';
import { captureLogs } from '../helpers/fakes/log-capture';
import { SequentialIdGenerator } from '../helpers/fakes/sequential-id.generator';
import { ThrowingIdGenerator } from '../helpers/fakes/throwing-id.generator';
import { parseJsonBody } from '../helpers/json-body';

/*
 * Os literais abaixo são o contrato de docs/requisitos.md. De propósito, nada é importado de
 * `error-messages.ts`: o teste prova o contrato, não a constante.
 */
const JSON_CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
};

const SEED_SCHEDULES = {
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
    {
      id: 3,
      nome: 'Dra. Ana Pereira',
      especialidade: 'Pediatra',
      horarios_disponiveis: ['2026-06-12 08:00', '2026-06-12 09:00', '2026-06-12 10:00'],
    },
    {
      id: 4,
      nome: 'Dr. Ricardo Lima',
      especialidade: 'Ortopedista',
      horarios_disponiveis: ['2026-06-15 13:00', '2026-06-15 14:00'],
    },
    {
      id: 5,
      nome: 'Dra. Fernanda Costa',
      especialidade: 'Clínico Geral',
      horarios_disponiveis: ['2026-06-16 08:00', '2026-06-16 09:00', '2026-06-16 10:00'],
    },
  ],
};

const CREATED_ENUNCIADO = {
  mensagem: 'Agendamento realizado com sucesso',
  agendamento: {
    id: 'appointment-1',
    medico: 'Dr. João Silva',
    paciente: 'Carlos Almeida',
    data_horario: '2026-06-10 09:00',
  },
};

const SLOT_UNAVAILABLE = {
  erro: 'Horário indisponível',
  mensagem: 'O horário solicitado não está mais disponível para este médico.',
};

const DOCTOR_NOT_FOUND = {
  erro: 'Médico não encontrado',
  mensagem: 'O médico informado não existe.',
};

const SLOT_NOT_OFFERED = {
  erro: 'Horário não ofertado',
  mensagem: 'O horário solicitado não faz parte da agenda deste médico.',
};

const INTERNAL_ERROR = {
  erro: 'Erro interno',
  mensagem: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
};

function invalidPayload(campo: string, problema: string): unknown {
  return {
    erro: 'Payload inválido',
    mensagem: 'O corpo da requisição é inválido. Verifique os detalhes.',
    detalhes: [{ campo, problema }],
  };
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type ScheduleHandler = ReturnType<typeof createScheduleHandler>;

/** Container novo por teste: estado em memória e ids isolados (docs/regras/testes.md). */
function makeSut(idGenerator: IdGenerator = new SequentialIdGenerator()): {
  handler: ScheduleHandler;
  logs: LogCapture;
} {
  const logs = captureLogs();
  const handler = createScheduleHandler(createContainer({ idGenerator, logWriter: logs.write }));
  return { handler, logs };
}

function getSchedules(handler: ScheduleHandler): Promise<APIGatewayProxyResult> {
  return handler(anApiGatewayEvent({ method: 'GET', resource: '/agendas' }));
}

function postAppointment(
  handler: ScheduleHandler,
  payload: unknown = anAppointmentPayload(),
): Promise<APIGatewayProxyResult> {
  return handler(aJsonPostEvent('/agendamento', payload));
}

function postRawBody(
  handler: ScheduleHandler,
  body: string | null,
): Promise<APIGatewayProxyResult> {
  return handler(
    anApiGatewayEvent({
      method: 'POST',
      resource: '/agendamento',
      body,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('schedule handler (GET /agendas + POST /agendamento)', () => {
  describe('GET /agendas', () => {
    it('responde 200 com todos os médicos do seed e seus horários, na ordem do seed', async () => {
      const { handler } = makeSut();

      const result = await getSchedules(handler);

      expect(result.statusCode).toBe(200);
      expect(parseJsonBody(result)).toEqual(SEED_SCHEDULES);
    });
  });

  describe('POST /agendamento — sucesso', () => {
    it('responde 201 com o corpo do enunciado para o payload do enunciado', async () => {
      const { handler } = makeSut();

      const result = await postAppointment(handler);

      expect(result.statusCode).toBe(201);
      expect(parseJsonBody(result)).toEqual(CREATED_ENUNCIADO);
    });

    it('aceita JSON válido sem header Content-Type (D24)', async () => {
      const { handler } = makeSut();

      const result = await handler(
        aJsonPostEvent('/agendamento', anAppointmentPayload(), { headers: {} }),
      );

      expect(result.statusCode).toBe(201);
      expect(parseJsonBody(result)).toEqual(CREATED_ENUNCIADO);
    });

    it('aceita JSON válido enviado como application/x-www-form-urlencoded, como o curl -d (D24)', async () => {
      const { handler } = makeSut();

      const result = await handler(
        aJsonPostEvent('/agendamento', anAppointmentPayload(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      expect(result.statusCode).toBe(201);
      expect(parseJsonBody(result)).toEqual(CREATED_ENUNCIADO);
    });

    it('devolve o nome do paciente sem os espaços das pontas (D12)', async () => {
      const { handler } = makeSut();

      const result = await postAppointment(
        handler,
        anAppointmentPayload({ paciente: '   Carlos Almeida  ' }),
      );

      expect(result.statusCode).toBe(201);
      expect(parseJsonBody(result)).toEqual(CREATED_ENUNCIADO);
    });

    it('ignora campos extras no payload', async () => {
      const { handler } = makeSut();

      const result = await postAppointment(handler, {
        ...anAppointmentPayload({ convenio: 'Leve' }),
        origem: 'app',
      });

      expect(result.statusCode).toBe(201);
      expect(parseJsonBody(result)).toEqual(CREATED_ENUNCIADO);
    });

    it('gera um id novo para cada agendamento', async () => {
      const { handler } = makeSut();
      await postAppointment(handler);

      const result = await postAppointment(
        handler,
        anAppointmentPayload({ medico_id: 2, data_horario: '2026-06-11 14:00' }),
      );

      expect(parseJsonBody(result)).toEqual({
        mensagem: 'Agendamento realizado com sucesso',
        agendamento: {
          id: 'appointment-2',
          medico: 'Dra. Maria Souza',
          paciente: 'Carlos Almeida',
          data_horario: '2026-06-11 14:00',
        },
      });
    });
  });

  describe('POST /agendamento — payload inválido (400)', () => {
    it('responde 400 para JSON malformado', async () => {
      const { handler } = makeSut();

      const result = await postRawBody(handler, '{"agendamento": {"medico_id": 1,');

      expect(result.statusCode).toBe(400);
      expect(parseJsonBody(result)).toEqual(invalidPayload('corpo', 'deve ser um JSON válido'));
    });

    it.each([
      ['ausente', null],
      ['vazio', ''],
    ])('responde 400 para body %s', async (_label, body) => {
      const { handler } = makeSut();

      const result = await postRawBody(handler, body);

      expect(result.statusCode).toBe(400);
      expect(parseJsonBody(result)).toEqual(invalidPayload('corpo', 'é obrigatório'));
    });

    it('responde 400 para objeto JSON vazio, apontando agendamento', async () => {
      const { handler } = makeSut();

      const result = await postAppointment(handler, {});

      expect(result.statusCode).toBe(400);
      expect(parseJsonBody(result)).toEqual(invalidPayload('agendamento', 'é obrigatório'));
    });

    it('responde 400 para medico_id em texto, apontando agendamento.medico_id', async () => {
      const { handler } = makeSut();

      const result = await postAppointment(handler, anAppointmentPayload({ medico_id: '1' }));

      expect(result.statusCode).toBe(400);
      expect(parseJsonBody(result)).toEqual(
        invalidPayload('agendamento.medico_id', 'deve ser um número inteiro'),
      );
    });

    it('responde 400 para data inexistente 2026-02-30 10:00 (D2)', async () => {
      const { handler } = makeSut();

      const result = await postAppointment(
        handler,
        anAppointmentPayload({ data_horario: '2026-02-30 10:00' }),
      );

      expect(result.statusCode).toBe(400);
      expect(parseJsonBody(result)).toEqual(
        invalidPayload(
          'agendamento.data_horario',
          'deve estar no formato YYYY-MM-DD HH:mm e ser uma data válida',
        ),
      );
    });

    it('responde 400 para paciente vazio', async () => {
      const { handler } = makeSut();

      const result = await postAppointment(handler, anAppointmentPayload({ paciente: '' }));

      expect(result.statusCode).toBe(400);
      expect(parseJsonBody(result)).toEqual(
        invalidPayload('agendamento.paciente', 'deve ter pelo menos 3 caracteres'),
      );
    });

    it('não reserva o horário quando o payload é inválido', async () => {
      const { handler } = makeSut();
      await postAppointment(handler, anAppointmentPayload({ paciente: '' }));

      const result = await getSchedules(handler);

      expect(parseJsonBody(result)).toEqual(SEED_SCHEDULES);
    });
  });

  describe('POST /agendamento — erros de negócio', () => {
    it('responde 404 quando o médico não existe (D4)', async () => {
      const { handler } = makeSut();

      const result = await postAppointment(handler, anAppointmentPayload({ medico_id: 999 }));

      expect(result.statusCode).toBe(404);
      expect(parseJsonBody(result)).toEqual(DOCTOR_NOT_FOUND);
    });

    it('responde 422 quando o horário nunca fez parte da agenda do médico (D5)', async () => {
      const { handler } = makeSut();

      const result = await postAppointment(
        handler,
        anAppointmentPayload({ data_horario: '2026-06-11 14:00' }),
      );

      expect(result.statusCode).toBe(422);
      expect(parseJsonBody(result)).toEqual(SLOT_NOT_OFFERED);
    });

    it('responde 409 com o texto exato do enunciado quando o horário já foi reservado', async () => {
      const { handler } = makeSut();
      await postAppointment(handler);

      const result = await postAppointment(
        handler,
        anAppointmentPayload({ paciente: 'Outra Pessoa' }),
      );

      expect(result.statusCode).toBe(409);
      expect(parseJsonBody(result)).toEqual(SLOT_UNAVAILABLE);
    });
  });

  describe('fluxo de negócio', () => {
    it('agendar remove o horário do GET /agendas e reagendar o mesmo horário responde 409', async () => {
      const { handler } = makeSut();

      const created = await postAppointment(handler);
      const schedules = await getSchedules(handler);
      const retry = await postAppointment(handler);

      expect(created.statusCode).toBe(201);
      expect(parseJsonBody(schedules)).toEqual({
        medicos: [
          {
            id: 1,
            nome: 'Dr. João Silva',
            especialidade: 'Cardiologista',
            horarios_disponiveis: ['2026-06-10 10:00', '2026-06-10 11:00'],
          },
          ...SEED_SCHEDULES.medicos.slice(1),
        ],
      });
      expect(retry.statusCode).toBe(409);
      expect(parseJsonBody(retry)).toEqual(SLOT_UNAVAILABLE);
    });

    it('mantém no GET /agendas o médico sem horários livres, com lista vazia (D21)', async () => {
      const { handler } = makeSut();
      await postAppointment(
        handler,
        anAppointmentPayload({ medico_id: 2, data_horario: '2026-06-11 14:00' }),
      );
      await postAppointment(
        handler,
        anAppointmentPayload({ medico_id: 2, data_horario: '2026-06-11 15:00' }),
      );

      const result = await getSchedules(handler);

      expect(parseJsonBody(result)).toEqual({
        medicos: [
          SEED_SCHEDULES.medicos[0],
          {
            id: 2,
            nome: 'Dra. Maria Souza',
            especialidade: 'Dermatologista',
            horarios_disponiveis: [],
          },
          ...SEED_SCHEDULES.medicos.slice(2),
        ],
      });
    });

    it('isola o estado entre containers diferentes', async () => {
      const first = makeSut();
      const second = makeSut();
      await postAppointment(first.handler);

      const schedules = await getSchedules(second.handler);
      const created = await postAppointment(second.handler);

      expect(parseJsonBody(schedules)).toEqual(SEED_SCHEDULES);
      expect(created.statusCode).toBe(201);
      expect(parseJsonBody(created)).toEqual(CREATED_ENUNCIADO);
    });
  });

  describe('evento com headers nulos (console da AWS, serverless invoke)', () => {
    it('GET /agendas sem headers nem body responde 200 com o seed', async () => {
      const { handler } = makeSut();
      const result = await handler({
        httpMethod: 'GET',
        resource: '/agendas',
        headers: null,
        requestContext: { requestId: 'req-console' },
      });

      expect(result.statusCode).toBe(200);
      expect(parseJsonBody(result)).toEqual(SEED_SCHEDULES);
    });

    it('POST /agendamento com headers nulos e JSON válido responde 201 (D24)', async () => {
      const { handler } = makeSut();

      const result = await handler({
        ...aJsonPostEvent('/agendamento', anAppointmentPayload()),
        headers: null,
      });

      expect(result.statusCode).toBe(201);
      expect(parseJsonBody(result)).toEqual(CREATED_ENUNCIADO);
    });
  });

  describe('container padrão', () => {
    it('gera um UUID v4 como id do agendamento quando nenhum IdGenerator é injetado', async () => {
      const logs = captureLogs();
      const handler = createScheduleHandler(createContainer({ logWriter: logs.write }));

      const anyUuidV4: unknown = expect.stringMatching(UUID_V4);

      const result = await postAppointment(handler);

      expect(result.statusCode).toBe(201);
      expect(parseJsonBody(result)).toEqual({
        ...CREATED_ENUNCIADO,
        agendamento: { ...CREATED_ENUNCIADO.agendamento, id: anyUuidV4 },
      });
    });
  });

  describe('falhas inesperadas (500)', () => {
    it('responde 500 genérico para rota fora da tabela de roteamento', async () => {
      const { handler, logs } = makeSut();

      const result = await handler(anApiGatewayEvent({ method: 'DELETE', resource: '/agendas' }));

      expect(result.statusCode).toBe(500);
      expect(parseJsonBody(result)).toEqual(INTERNAL_ERROR);
      expect(logs.ofLevel('error')).toHaveLength(1);
    });

    it('responde 500 genérico, sem mensagem interna nem stack, quando uma dependência lança', async () => {
      const failingIdGenerator = new ThrowingIdGenerator();
      const { handler, logs } = makeSut(failingIdGenerator);

      const result = await postAppointment(handler);

      expect(result.statusCode).toBe(500);
      expect(parseJsonBody(result)).toEqual(INTERNAL_ERROR);
      expect(result.body).not.toContain('segredo-interno');
      expect(result.body).not.toContain(String(failingIdGenerator.failure.stack));
      expect(logs.text).toContain('segredo-interno');
    });
  });

  describe('headers', () => {
    const scenarios: ReadonlyArray<
      readonly [number, (handler: ScheduleHandler) => Promise<APIGatewayProxyResult>]
    > = [
      [200, (handler) => getSchedules(handler)],
      [201, (handler) => postAppointment(handler)],
      [400, (handler) => postRawBody(handler, '{')],
      [404, (handler) => postAppointment(handler, anAppointmentPayload({ medico_id: 999 }))],
      [
        409,
        async (handler) => {
          await postAppointment(handler);
          return postAppointment(handler);
        },
      ],
      [
        422,
        (handler) =>
          postAppointment(handler, anAppointmentPayload({ data_horario: '2026-06-11 14:00' })),
      ],
      [500, (handler) => handler(anApiGatewayEvent({ method: 'PUT', resource: '/agendamento' }))],
    ];

    it.each(scenarios)(
      'inclui Content-Type JSON e CORS na resposta %d',
      async (statusCode, act) => {
        const { handler } = makeSut();

        const result = await act(handler);

        expect(result.statusCode).toBe(statusCode);
        expect(result.headers).toEqual(JSON_CORS_HEADERS);
      },
    );

    it('inclui Content-Type JSON e CORS no 500 de falha inesperada de dependência', async () => {
      const { handler } = makeSut(new ThrowingIdGenerator());

      const result = await postAppointment(handler);

      expect(result.statusCode).toBe(500);
      expect(result.headers).toEqual(JSON_CORS_HEADERS);
    });
  });

  describe('logging', () => {
    it('registra uma linha info por requisição com requestId, rota e status', async () => {
      const { handler, logs } = makeSut();

      await handler(
        aJsonPostEvent('/agendamento', anAppointmentPayload(), { requestId: 'req-integracao' }),
      );

      expect(logs.ofLevel('info')).toContainEqual(
        expect.objectContaining({
          requestId: 'req-integracao',
          method: 'POST',
          resource: '/agendamento',
          statusCode: 201,
        }),
      );
    });

    // A ordem @LogRequest > @HandleHttpErrors > @ValidateBody (ADR-007) garante que o log de acesso
    // enxerga o status final mesmo quando a validação barra ou quando algo lança.
    it('registra a linha info com status 400 quando o corpo é inválido', async () => {
      const { handler, logs } = makeSut();

      await postRawBody(handler, '{');

      expect(logs.ofLevel('info')).toContainEqual(
        expect.objectContaining({ method: 'POST', resource: '/agendamento', statusCode: 400 }),
      );
    });

    it('registra a linha info com status 500 quando uma dependência lança', async () => {
      const { handler, logs } = makeSut(new ThrowingIdGenerator());

      await postAppointment(handler);

      expect(logs.ofLevel('info')).toContainEqual(
        expect.objectContaining({ method: 'POST', resource: '/agendamento', statusCode: 500 }),
      );
    });
  });
});
