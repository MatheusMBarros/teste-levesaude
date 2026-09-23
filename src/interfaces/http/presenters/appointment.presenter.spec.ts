import { slot } from '../../../../tests/helpers/builders/slot';
import type { Appointment } from '../../../domain/entities/appointment.entity';
import { presentCreatedAppointment } from './appointment.presenter';

describe('presentCreatedAppointment', () => {
  it('converte o agendamento para o corpo 201 do enunciado', () => {
    const appointment: Appointment = {
      id: 'appointment-1',
      doctorId: 1,
      doctorName: 'Dr. João Silva',
      patient: 'Carlos Almeida',
      slot: slot('2026-06-10 09:00'),
    };

    const body = presentCreatedAppointment(appointment);

    expect(body).toEqual({
      mensagem: 'Agendamento realizado com sucesso',
      agendamento: {
        id: 'appointment-1',
        medico: 'Dr. João Silva',
        paciente: 'Carlos Almeida',
        data_horario: '2026-06-10 09:00',
      },
    });
  });
});
