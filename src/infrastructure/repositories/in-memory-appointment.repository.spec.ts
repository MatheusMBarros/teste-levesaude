import { slot } from '../../../tests/helpers/builders/slot';
import type { Appointment } from '../../domain/entities/appointment.entity';
import { InMemoryAppointmentRepository } from './in-memory-appointment.repository';

function anAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: overrides.id ?? 'appointment-1',
    doctorId: overrides.doctorId ?? 1,
    doctorName: overrides.doctorName ?? 'Dr. João Silva',
    patient: overrides.patient ?? 'Carlos Almeida',
    slot: overrides.slot ?? slot('2026-06-10 09:00'),
  };
}

describe('InMemoryAppointmentRepository', () => {
  it('começa sem agendamentos', () => {
    const sut = new InMemoryAppointmentRepository();

    expect(sut.saved).toEqual([]);
  });

  it('armazena o agendamento salvo', async () => {
    const sut = new InMemoryAppointmentRepository();
    const appointment = anAppointment();

    await sut.save(appointment);

    expect(sut.saved).toEqual([appointment]);
  });

  it('mantém os agendamentos na ordem em que foram salvos', async () => {
    const sut = new InMemoryAppointmentRepository();

    await sut.save(anAppointment({ id: 'appointment-1' }));
    await sut.save(anAppointment({ id: 'appointment-2', slot: slot('2026-06-10 10:00') }));

    expect(sut.saved.map((appointment) => appointment.id)).toEqual([
      'appointment-1',
      'appointment-2',
    ]);
  });

  it('não expõe o array interno: a lista devolvida não muda com salvamentos posteriores', async () => {
    const sut = new InMemoryAppointmentRepository();
    await sut.save(anAppointment({ id: 'appointment-1' }));
    const snapshot = sut.saved;

    await sut.save(anAppointment({ id: 'appointment-2' }));

    expect(snapshot.map((appointment) => appointment.id)).toEqual(['appointment-1']);
  });
});
