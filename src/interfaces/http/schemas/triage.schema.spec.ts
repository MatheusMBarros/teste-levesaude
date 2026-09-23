import { aJsonHttpRequest } from '../../../../tests/helpers/http-request';
import { expectOk } from '../../../../tests/helpers/result-assertions';
import type { TriageBody } from './triage.schema';
import { triageBody, triageSchema } from './triage.schema';

interface SchemaIssue {
  /** Caminho do campo com pontos; `''` é a raiz do corpo. */
  readonly path: string;
  readonly message: string;
}

function parse(payload: unknown): TriageBody {
  const result = triageSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Esperava payload válido, recebeu: ${result.error.message}`);
  }
  return result.data;
}

function issuesOf(payload: unknown): ReadonlyArray<SchemaIssue> {
  const result = triageSchema.safeParse(payload);
  if (result.success) {
    throw new Error('Esperava falha de validação, mas o payload foi aceito');
  }
  return result.error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

describe('triageSchema', () => {
  describe('payload válido', () => {
    it('aceita o relato do exemplo do contrato', () => {
      const body = parse({ sintomas: 'Dor no peito aos esforços e palpitações' });

      expect(body).toEqual({ sintomas: 'Dor no peito aos esforços e palpitações' });
    });

    it.each([
      ['10 caracteres', 'a'.repeat(10)],
      ['2000 caracteres', 'a'.repeat(2000)],
      ['10 caracteres após o trim', `   ${'a'.repeat(10)}   `],
      ['2000 caracteres após o trim', ` ${'a'.repeat(2000)} `],
    ])('aceita sintomas com %s (limites do contrato 3)', (_label, sintomas) => {
      const body = parse({ sintomas });

      expect(body.sintomas).toBe(sintomas.trim());
    });

    it('remove os espaços das pontas dos sintomas', () => {
      const body = parse({ sintomas: '  Dor de cabeça há 3 dias  ' });

      expect(body.sintomas).toBe('Dor de cabeça há 3 dias');
    });

    it('preserva quebras de linha internas do relato', () => {
      const body = parse({ sintomas: 'Dor de cabeça\nhá 3 dias' });

      expect(body.sintomas).toBe('Dor de cabeça\nhá 3 dias');
    });
  });

  describe('sintomas (texto com trim, 10 a 2000 caracteres)', () => {
    it('rejeita corpo sem sintomas com "é obrigatório"', () => {
      expect(issuesOf({})).toEqual([{ path: 'sintomas', message: 'é obrigatório' }]);
    });

    it.each([
      ['número', 42],
      ['null', null],
      ['lista', ['dor no peito']],
      ['objeto', { texto: 'dor no peito' }],
    ])('rejeita sintomas do tipo %s com "deve ser um texto"', (_label, sintomas) => {
      expect(issuesOf({ sintomas })).toEqual([{ path: 'sintomas', message: 'deve ser um texto' }]);
    });

    it.each([
      ['9 caracteres', 'a'.repeat(9)],
      ['texto vazio', ''],
      ['só espaços', ' '.repeat(20)],
      ['9 caracteres após o trim', `     ${'a'.repeat(9)}     `],
    ])('rejeita sintomas com %s com "deve ter pelo menos 10 caracteres"', (_label, sintomas) => {
      expect(issuesOf({ sintomas })).toEqual([
        { path: 'sintomas', message: 'deve ter pelo menos 10 caracteres' },
      ]);
    });

    it('rejeita sintomas com 2001 caracteres com "deve ter no máximo 2000 caracteres"', () => {
      expect(issuesOf({ sintomas: 'a'.repeat(2001) })).toEqual([
        { path: 'sintomas', message: 'deve ter no máximo 2000 caracteres' },
      ]);
    });

    it.each([
      ['curto', 'segredo'],
      ['longo', `segredo-do-paciente ${'a'.repeat(2000)}`],
    ])('não ecoa o relato na mensagem de erro (texto %s)', (_label, sintomas) => {
      const issues = issuesOf({ sintomas });

      expect(JSON.stringify(issues)).not.toContain('segredo');
    });
  });
});

describe('triageBody', () => {
  it('valida o corpo JSON da requisição e devolve os sintomas já com trim', () => {
    const request = aJsonHttpRequest({ sintomas: '  Dor no peito aos esforços  ' });

    const body = expectOk(triageBody.validate(request));

    expect(body).toEqual({ sintomas: 'Dor no peito aos esforços' });
    expect(triageBody.of(request)).toEqual({ sintomas: 'Dor no peito aos esforços' });
  });
});
