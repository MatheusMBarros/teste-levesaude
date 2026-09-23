import type { AppointmentRepository } from '../../../src/application/ports/appointment-repository.port';
import type { Appointment } from '../../../src/domain/entities/appointment.entity';

export interface FakeAppointmentRepositoryOptions {
  /** Quando definido, `save` rejeita com este erro (simula falha inesperada de infraestrutura). */
  readonly failWith?: Error;
}

/** Fake de `AppointmentRepository` que guarda em memória os agendamentos salvos. */
export class FakeAppointmentRepository implements AppointmentRepository {
  private readonly savedAppointments: Appointment[] = [];

  constructor(private readonly options: FakeAppointmentRepositoryOptions = {}) {}

  get saved(): ReadonlyArray<Appointment> {
    return this.savedAppointments;
  }

  save(appointment: Appointment): Promise<void> {
    if (this.options.failWith !== undefined) {
      return Promise.reject(this.options.failWith);
    }
    this.savedAppointments.push(appointment);
    return Promise.resolve();
  }
}
