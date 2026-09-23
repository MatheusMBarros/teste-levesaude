import type { Specialty } from './specialty.value-object';
import { SPECIALTIES } from './specialty.value-object';

describe('SPECIALTIES', () => {
  it('define a lista fechada de especialidades atendidas, incluindo Clínico Geral', () => {
    const specialties = Object.values(SPECIALTIES);

    expect(specialties).toEqual([
      'Cardiologista',
      'Dermatologista',
      'Pediatra',
      'Ortopedista',
      'Clínico Geral',
    ]);
  });

  it('rejeita em tempo de compilação uma especialidade fora da lista', () => {
    // @ts-expect-error: 'Neurologista' não faz parte da lista fechada de especialidades
    const invalid: Specialty = 'Neurologista';

    expect(invalid).toBe('Neurologista');
  });
});
