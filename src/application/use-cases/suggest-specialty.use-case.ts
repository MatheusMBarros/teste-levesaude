import type { Doctor } from '../../domain/entities/doctor.entity';
import type { SlotDateTime } from '../../domain/value-objects/slot-date-time.value-object';
import type { Specialty } from '../../domain/value-objects/specialty.value-object';
import { SPECIALTIES } from '../../domain/value-objects/specialty.value-object';
import type { Urgency } from '../../domain/value-objects/urgency.value-object';
import type { Result } from '../../shared/result';
import { err, ok } from '../../shared/result';
import type { ScheduleRepository } from '../ports/schedule-repository.port';
import type { TriageError, TriageModel } from '../ports/triage-model.port';
import type { UseCase } from './use-case';

/** Aviso fixo do contrato 3, presente em toda resposta de sucesso (inclusive emergência). */
export const TRIAGE_DISCLAIMER =
  'Esta é uma sugestão automatizada e não substitui avaliação médica. Em caso de emergência, ligue 192.';

/** Orientação que abre a justificativa quando a urgência é `emergencia` (D25). */
export const EMERGENCY_GUIDANCE = 'Procure imediatamente um pronto-socorro ou ligue 192 (SAMU).';

export interface SuggestSpecialtyInput {
  /** Relato já validado na borda (trim, 10 a 2000 caracteres). */
  readonly symptoms: string;
}

/** Médico da especialidade sugerida com o horário livre mais cedo (D26). */
export interface AvailableDoctor {
  readonly id: number;
  readonly name: string;
  readonly nextSlot: SlotDateTime;
}

export interface SpecialtySuggestion {
  readonly specialty: Specialty;
  readonly urgency: Urgency;
  readonly rationale: string;
  readonly availableDoctors: ReadonlyArray<AvailableDoctor>;
  readonly disclaimer: string;
}

function earliest(slots: ReadonlyArray<SlotDateTime>): SlotDateTime | undefined {
  return slots.reduce<SlotDateTime | undefined>(
    (current, slot) => (current === undefined || slot.isBefore(current) ? slot : current),
    undefined,
  );
}

function toAvailableDoctor(doctor: Doctor): AvailableDoctor | undefined {
  const nextSlot = earliest(doctor.availableSlots);
  return nextSlot === undefined ? undefined : { id: doctor.id, name: doctor.name, nextSlot };
}

/**
 * Regra de negócio da triagem; não conhece o SDK nem o prompt (ADR-010):
 * - consulta o modelo com a lista fechada `SPECIALTIES`; a validade da resposta é garantia da
 *   porta (`Specialty` tipado), então não há fallback aqui;
 * - falha do modelo volta como está, sem consultar a agenda;
 * - a agenda é lida **depois** do modelo, para refletir reservas feitas durante a chamada;
 * - médicos da especialidade com ao menos um horário livre, na ordem do seed, cada um com o
 *   horário mais cedo (D26);
 * - em `emergencia`, a justificativa começa com `EMERGENCY_GUIDANCE` (D25);
 * - o aviso fixo acompanha toda resposta.
 */
export class SuggestSpecialtyUseCase implements UseCase<
  SuggestSpecialtyInput,
  Result<SpecialtySuggestion, TriageError>
> {
  constructor(
    private readonly triageModel: TriageModel,
    private readonly scheduleRepository: ScheduleRepository,
  ) {}

  async execute(input: SuggestSpecialtyInput): Promise<Result<SpecialtySuggestion, TriageError>> {
    const classification = await this.triageModel.classify({
      symptoms: input.symptoms,
      allowedSpecialties: SPECIALTIES,
    });
    if (!classification.ok) {
      return err(classification.error);
    }

    const { specialty, urgency, rationale } = classification.value;
    const doctors = await this.scheduleRepository.list();

    return ok({
      specialty,
      urgency,
      rationale: urgency === 'emergencia' ? `${EMERGENCY_GUIDANCE} ${rationale}` : rationale,
      availableDoctors: doctors
        .filter((doctor) => doctor.specialty === specialty)
        .map(toAvailableDoctor)
        .filter((doctor) => doctor !== undefined),
      disclaimer: TRIAGE_DISCLAIMER,
    });
  }
}
