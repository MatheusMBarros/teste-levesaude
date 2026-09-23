import type { SlotDateTime } from '../value-objects/slot-date-time.value-object';

/**
 * Agendamento confirmado. `doctorName` é um snapshot do nome no momento da reserva
 * (registro histórico, e o que o contrato 201 devolve em `medico`), evitando nova
 * consulta ao repositório só para montar a resposta.
 */
export interface Appointment {
  readonly id: string;
  readonly doctorId: number;
  readonly doctorName: string;
  readonly patient: string;
  readonly slot: SlotDateTime;
}
