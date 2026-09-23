import { SPECIALTIES } from '../../domain/value-objects/specialty.value-object';
import { URGENCY_LEVELS } from '../../domain/value-objects/urgency.value-object';
import { triageOutputSchema } from './triage-output.schema';

function anOutput(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    specialty: 'Cardiologista',
    urgency: 'media',
    rationale: 'Dor no peito aos esforços e palpitações sugerem avaliação cardiológica.',
    ...overrides,
  };
}

function isValid(output: unknown): boolean {
  return triageOutputSchema(SPECIALTIES).safeParse(output).success;
}

describe('triageOutputSchema', () => {
  describe('saída válida', () => {
    it('aceita especialidade, urgência e justificativa válidas', () => {
      const result = triageOutputSchema(SPECIALTIES).safeParse(anOutput());

      expect(result.success && result.data).toEqual({
        specialty: 'Cardiologista',
        urgency: 'media',
        rationale: 'Dor no peito aos esforços e palpitações sugerem avaliação cardiológica.',
      });
    });

    it.each(SPECIALTIES)('aceita a especialidade %s', (specialty) => {
      expect(isValid(anOutput({ specialty }))).toBe(true);
    });

    it.each(URGENCY_LEVELS)('aceita a urgência %s', (urgency) => {
      expect(isValid(anOutput({ urgency }))).toBe(true);
    });

    it('remove os espaços das pontas da justificativa', () => {
      const result = triageOutputSchema(SPECIALTIES).safeParse(
        anOutput({ rationale: '  Motivo.  ' }),
      );

      expect(result.success && result.data.rationale).toBe('Motivo.');
    });

    it('aceita justificativa com 500 caracteres', () => {
      expect(isValid(anOutput({ rationale: 'a'.repeat(500) }))).toBe(true);
    });
  });

  describe('saída inválida', () => {
    it.each([
      ['fora da lista fechada', 'Neurologista'],
      ['com caixa diferente', 'cardiologista'],
      ['vazia', ''],
    ])('rejeita especialidade %s', (_label, specialty) => {
      expect(isValid(anOutput({ specialty }))).toBe(false);
    });

    it.each([
      ['com acento', 'média'],
      ['desconhecida', 'urgente'],
      ['em inglês', 'high'],
    ])('rejeita urgência %s', (_label, urgency) => {
      expect(isValid(anOutput({ urgency }))).toBe(false);
    });

    it.each([
      ['vazia', ''],
      ['só com espaços', '   '],
      ['com 501 caracteres', 'a'.repeat(501)],
    ])('rejeita justificativa %s', (_label, rationale) => {
      expect(isValid(anOutput({ rationale }))).toBe(false);
    });

    it.each(['specialty', 'urgency', 'rationale'])('rejeita saída sem %s', (field) => {
      const output = Object.fromEntries(
        Object.entries(anOutput()).filter(([name]) => name !== field),
      );

      expect(isValid(output)).toBe(false);
    });

    it('rejeita especialidade válida no domínio mas fora da lista recebida', () => {
      const schema = triageOutputSchema(['Cardiologista', 'Clínico Geral']);

      expect(schema.safeParse(anOutput({ specialty: 'Dermatologista' })).success).toBe(false);
      expect(schema.safeParse(anOutput({ specialty: 'Cardiologista' })).success).toBe(true);
    });

    it('rejeita campo extra (schema estrito)', () => {
      expect(isValid(anOutput({ diagnostico: 'infarto' }))).toBe(false);
    });

    it.each([
      ['null', null],
      ['texto', 'Cardiologista'],
      ['lista', []],
    ])('rejeita saída que não é objeto (%s)', (_label, output) => {
      expect(isValid(output)).toBe(false);
    });
  });
});
