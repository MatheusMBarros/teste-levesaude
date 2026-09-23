import type { AppointmentRepository } from '../../application/ports/appointment-repository.port';
import type { Appointment } from '../../domain/entities/appointment.entity';

export class InMemoryAppointmentRepository implements AppointmentRepository {
  private readonly appointments: Appointment[] = [];

  get saved(): ReadonlyArray<Appointment> {
    return [...this.appointments];
  }

  save(appointment: Appointment): Promise<void> {
    this.appointments.push(appointment);
    return Promise.resolve();
  }
}
