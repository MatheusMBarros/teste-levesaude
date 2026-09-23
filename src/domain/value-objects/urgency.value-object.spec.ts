import type { Urgency } from './urgency.value-object';
import { URGENCY_LEVELS } from './urgency.value-object';

describe('URGENCY_LEVELS', () => {
  it('define os níveis de urgência do contrato da triagem, do menor para o maior', () => {
    expect(URGENCY_LEVELS).toEqual(['baixa', 'media', 'alta', 'emergencia']);
  });

  it('rejeita em tempo de compilação um nível fora da lista', () => {
    // Garantia do `npm run typecheck` (ver specialty.value-object.spec.ts).
    // @ts-expect-error: 'urgente' não é um nível de urgência do contrato
    const invalid: Urgency = 'urgente';

    expect(invalid).toBeDefined();
  });
});
