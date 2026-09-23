import { slot } from '../../../../tests/helpers/builders/slot';
import type { SpecialtySuggestion } from '../../../application/use-cases/suggest-specialty.use-case';
import { TRIAGE_DISCLAIMER } from '../../../application/use-cases/suggest-specialty.use-case';
import { presentTriage } from './triage.presenter';

function aSuggestion(overrides: Partial<SpecialtySuggestion> = {}): SpecialtySuggestion {
  return {
    specialty: 'Cardiologista',
    urgency: 'media',
    rationale: 'Dor no peito aos esforços e palpitações sugerem avaliação cardiológica.',
    availableDoctors: [{ id: 1, name: 'Dr. João Silva', nextSlot: slot('2026-06-10 09:00') }],
    disclaimer: TRIAGE_DISCLAIMER,
    ...overrides,
  };
}

describe('presentTriage', () => {
  it('converte a sugestão para o corpo 200 do contrato 3 (snake_case em português)', () => {
    const body = presentTriage(aSuggestion());

    expect(body).toEqual({
      especialidade_sugerida: 'Cardiologista',
      urgencia: 'media',
      justificativa: 'Dor no peito aos esforços e palpitações sugerem avaliação cardiológica.',
      medicos_disponiveis: [{ id: 1, nome: 'Dr. João Silva', proximo_horario: '2026-06-10 09:00' }],
      aviso:
        'Esta é uma sugestão automatizada e não substitui avaliação médica. Em caso de emergência, ligue 192.',
    });
  });

  it('mantém a ordem dos médicos recebida', () => {
    const body = presentTriage(
      aSuggestion({
        specialty: 'Dermatologista',
        availableDoctors: [
          { id: 7, name: 'Dr. Paulo Reis', nextSlot: slot('2026-06-20 08:00') },
          { id: 2, name: 'Dra. Maria Souza', nextSlot: slot('2026-06-11 14:00') },
        ],
      }),
    );

    expect(body.medicos_disponiveis).toEqual([
      { id: 7, nome: 'Dr. Paulo Reis', proximo_horario: '2026-06-20 08:00' },
      { id: 2, nome: 'Dra. Maria Souza', proximo_horario: '2026-06-11 14:00' },
    ]);
  });

  it('devolve medicos_disponiveis vazio quando não há médico com horário livre', () => {
    const body = presentTriage(aSuggestion({ availableDoctors: [] }));

    expect(body.medicos_disponiveis).toEqual([]);
  });
});
