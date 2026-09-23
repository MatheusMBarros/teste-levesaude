import type { Specialty } from './specialty.value-object';
import { SPECIALTIES } from './specialty.value-object';

describe('SPECIALTIES', () => {
  it('define a lista fechada de especialidades atendidas, incluindo Clínico Geral', () => {
    expect(SPECIALTIES).toEqual([
      'Cardiologista',
      'Dermatologista',
      'Pediatra',
      'Ortopedista',
      'Clínico Geral',
    ]);
  });

  it('rejeita em tempo de compilação uma especialidade fora da lista', () => {
    // A garantia é do `npm run typecheck` (tsc inclui os specs): se o valor passar a ser aceito,
    // o @ts-expect-error fica sem uso e o build quebra. O ts-jest só transpila (isolatedModules).
    // @ts-expect-error: 'Neurologista' não faz parte da lista fechada de especialidades
    const invalid: Specialty = 'Neurologista';

    expect(invalid).toBeDefined();
  });
});
