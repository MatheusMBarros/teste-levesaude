import type { SlotDateTime } from '../value-objects/slot-date-time.value-object';

/**
 * Médico e sua agenda **disponível** no momento da leitura. Horários já reservados não
 * aparecem em `availableSlots` (D6); quem sabe distinguir "reservado" de "nunca ofertado"
 * é o `ScheduleRepository` (ADR-004).
 */
export interface Doctor {
  readonly id: number;
  readonly name: string;
  readonly specialty: string;
  readonly availableSlots: ReadonlyArray<SlotDateTime>;
}
