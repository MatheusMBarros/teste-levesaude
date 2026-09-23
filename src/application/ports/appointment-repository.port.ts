import type { Appointment } from '../../domain/entities/appointment.entity';

/**
 * Registro dos agendamentos confirmados (quem reservou o quê). Só escrita por enquanto:
 * nenhum endpoint lê agendamentos; leitura entra quando houver caso de uso que a exija (ADR-004).
 */
export interface AppointmentRepository {
  save(appointment: Appointment): Promise<void>;
}
