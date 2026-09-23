import type { SpecialtySuggestion } from '../../../application/use-cases/suggest-specialty.use-case';
import type { Specialty } from '../../../domain/value-objects/specialty.value-object';
import type { Urgency } from '../../../domain/value-objects/urgency.value-object';

/** Item de `medicos_disponiveis` no contrato 3. */
export interface AvailableDoctorBody {
  readonly id: number;
  readonly nome: string;
  readonly proximo_horario: string;
}

/** Corpo 200 de `POST /triagem` (contrato 3). Chaves literais do contrato (D11). */
export interface TriageResponseBody {
  readonly especialidade_sugerida: Specialty;
  readonly urgencia: Urgency;
  readonly justificativa: string;
  readonly medicos_disponiveis: ReadonlyArray<AvailableDoctorBody>;
  readonly aviso: string;
}

/** Mantém a ordem dos médicos recebida do caso de uso (ordem do seed, D26). */
export function presentTriage(suggestion: SpecialtySuggestion): TriageResponseBody {
  return {
    especialidade_sugerida: suggestion.specialty,
    urgencia: suggestion.urgency,
    justificativa: suggestion.rationale,
    medicos_disponiveis: suggestion.availableDoctors.map((doctor) => ({
      id: doctor.id,
      nome: doctor.name,
      proximo_horario: doctor.nextSlot.toString(),
    })),
    aviso: suggestion.disclaimer,
  };
}
