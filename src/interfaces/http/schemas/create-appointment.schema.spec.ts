import {
  anAppointmentPayload,
  anAppointmentPayloadWithout,
} from '../../../../tests/helpers/builders/appointment-payload';
import { slot } from '../../../../tests/helpers/builders/slot';
import type { CreateAppointmentBody } from './create-appointment.schema';
import { createAppointmentSchema } from './create-appointment.schema';

interface SchemaIssue {
  /** Caminho do campo com pontos; `''` é a raiz do corpo. */
  readonly path: string;
  readonly message: string;
}

function parse(payload: unknown): CreateAppointmentBody {
  const result = createAppointmentSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Esperava payload válido, recebeu: ${result.error.message}`);
  }
  return result.data;
}

function issuesOf(payload: unknown): ReadonlyArray<SchemaIssue> {
  const result = createAppointmentSchema.safeParse(payload);
  if (result.success) {
    throw new Error('Esperava falha de validação, mas o payload foi aceito');
  }
  return result.error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

const FORMAT_PROBLEM = 'deve estar no formato YYYY-MM-DD HH:mm e ser uma data válida';

describe('createAppointmentSchema', () => {
  describe('payload válido', () => {
    it('aceita o payload do enunciado e converte data_horario em SlotDateTime', () => {
      const body = parse(anAppointmentPayload());

      expect(body).toEqual({
        agendamento: {
          medico_id: 1,
          paciente: 'Carlos Almeida',
          data_horario: slot('2026-06-10 09:00'),
        },
      });
    });

    it('remove os espaços das pontas do nome do paciente (D12)', () => {
      const body = parse(anAppointmentPayload({ paciente: '  Carlos Almeida  ' }));

      expect(body.agendamento.paciente).toBe('Carlos Almeida');
    });

    it.each([
      ['3 caracteres', 'Ana'],
      ['120 caracteres', 'A'.repeat(120)],
      ['120 caracteres após o trim', ` ${'A'.repeat(120)} `],
    ])('aceita paciente com %s (limite de D12)', (_label, paciente) => {
      const body = parse(anAppointmentPayload({ paciente }));

      expect(body.agendamento.paciente).toBe(paciente.trim());
    });

    it('aceita data no passado (D3)', () => {
      const body = parse(anAppointmentPayload({ data_horario: '2020-01-01 08:00' }));

      expect(body.agendamento.data_horario).toEqual(slot('2020-01-01 08:00'));
    });

    it('ignora campos extras na raiz e em agendamento', () => {
      const payload = {
        ...anAppointmentPayload({ observacao: 'primeira consulta' }),
        origem: 'app',
      };

      const body = parse(payload);

      expect(body).toEqual({
        agendamento: {
          medico_id: 1,
          paciente: 'Carlos Almeida',
          data_horario: slot('2026-06-10 09:00'),
        },
      });
    });
  });

  describe('estrutura do corpo', () => {
    it.each([
      ['lista', []],
      ['texto', 'agendamento'],
      ['número', 42],
      ['null', null],
    ])('rejeita corpo que é %s com "deve ser um objeto JSON" na raiz', (_label, payload) => {
      expect(issuesOf(payload)).toEqual([{ path: '', message: 'deve ser um objeto JSON' }]);
    });

    it('rejeita corpo sem agendamento com "é obrigatório"', () => {
      expect(issuesOf({})).toEqual([{ path: 'agendamento', message: 'é obrigatório' }]);
    });

    it.each([
      ['texto', 'consulta'],
      ['número', 1],
      ['lista', []],
      ['null', null],
    ])('rejeita agendamento que é %s com "deve ser um objeto"', (_label, agendamento) => {
      expect(issuesOf({ agendamento })).toEqual([
        { path: 'agendamento', message: 'deve ser um objeto' },
      ]);
    });

    it.each(['medico_id', 'paciente', 'data_horario'] as const)(
      'rejeita agendamento sem %s com "é obrigatório"',
      (field) => {
        expect(issuesOf(anAppointmentPayloadWithout(field))).toEqual([
          { path: `agendamento.${field}`, message: 'é obrigatório' },
        ]);
      },
    );

    it('reporta todos os campos inválidos de uma só vez', () => {
      const issues = issuesOf(
        anAppointmentPayload({ medico_id: 0, paciente: '', data_horario: '2026-02-30 10:00' }),
      );

      expect(issues).toHaveLength(3);
      expect(issues).toContainEqual({
        path: 'agendamento.medico_id',
        message: 'deve ser maior que zero',
      });
      expect(issues).toContainEqual({
        path: 'agendamento.paciente',
        message: 'deve ter pelo menos 3 caracteres',
      });
      expect(issues).toContainEqual({ path: 'agendamento.data_horario', message: FORMAT_PROBLEM });
    });
  });

  describe('medico_id (D13: inteiro positivo)', () => {
    it.each([
      ['texto numérico', '1'],
      ['decimal', 1.5],
      ['booleano', true],
      ['null', null],
    ])('rejeita %s com "deve ser um número inteiro"', (_label, medico_id) => {
      expect(issuesOf(anAppointmentPayload({ medico_id }))).toEqual([
        { path: 'agendamento.medico_id', message: 'deve ser um número inteiro' },
      ]);
    });

    it.each([0, -1])('rejeita %d com "deve ser maior que zero"', (medico_id) => {
      expect(issuesOf(anAppointmentPayload({ medico_id }))).toEqual([
        { path: 'agendamento.medico_id', message: 'deve ser maior que zero' },
      ]);
    });
  });

  describe('paciente (D12: texto com trim, 3 a 120 caracteres)', () => {
    it.each([
      ['número', 123],
      ['null', null],
      ['objeto', { nome: 'Carlos' }],
      ['lista com texto curto (sem o problema de tamanho junto)', ['ab']],
    ])('rejeita %s com "deve ser um texto"', (_label, paciente) => {
      expect(issuesOf(anAppointmentPayload({ paciente }))).toEqual([
        { path: 'agendamento.paciente', message: 'deve ser um texto' },
      ]);
    });

    it.each([
      ['vazio', ''],
      ['só com espaços', '     '],
      ['com 2 caracteres', 'Al'],
      ['com 2 caracteres após o trim', '  Al  '],
    ])('rejeita nome %s com "deve ter pelo menos 3 caracteres"', (_label, paciente) => {
      expect(issuesOf(anAppointmentPayload({ paciente }))).toEqual([
        { path: 'agendamento.paciente', message: 'deve ter pelo menos 3 caracteres' },
      ]);
    });

    it('rejeita nome com 121 caracteres com "deve ter no máximo 120 caracteres"', () => {
      expect(issuesOf(anAppointmentPayload({ paciente: 'A'.repeat(121) }))).toEqual([
        { path: 'agendamento.paciente', message: 'deve ter no máximo 120 caracteres' },
      ]);
    });
  });

  describe('data_horario (D2: YYYY-MM-DD HH:mm e data real)', () => {
    it.each([
      ['número', 202606100900],
      ['null', null],
    ])('rejeita %s com "deve ser um texto"', (_label, data_horario) => {
      expect(issuesOf(anAppointmentPayload({ data_horario }))).toEqual([
        { path: 'agendamento.data_horario', message: 'deve ser um texto' },
      ]);
    });

    it.each([
      ['dia que não existe', '2026-02-30 10:00'],
      ['29/02 em ano não bissexto', '2026-02-29 10:00'],
      ['mês 13', '2026-13-01 10:00'],
      ['hora 24', '2026-06-10 24:00'],
      ['formato ISO com T', '2026-06-10T09:00'],
      ['com segundos', '2026-06-10 09:00:00'],
      ['hora sem zero à esquerda', '2026-06-10 9:00'],
      ['formato brasileiro', '10/06/2026 09:00'],
      ['texto vazio', ''],
      ['espaço no início (D22, sem trim)', ' 2026-06-10 09:00'],
      ['espaço no fim (D22, sem trim)', '2026-06-10 09:00 '],
    ])('rejeita %s', (_label, data_horario) => {
      expect(issuesOf(anAppointmentPayload({ data_horario }))).toEqual([
        { path: 'agendamento.data_horario', message: FORMAT_PROBLEM },
      ]);
    });
  });
});
