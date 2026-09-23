import type { Appointment } from '../../../domain/entities/appointment.entity';

/** Corpo 201 de `POST /agendamento` (contrato 2). Chaves e `mensagem` literais do enunciado. */
export interface CreatedAppointmentBody {
  readonly mensagem: 'Agendamento realizado com sucesso';
  readonly agendamento: {
    readonly id: string;
    readonly medico: string;
    readonly paciente: string;
    readonly data_horario: string;
  };
}

export function presentCreatedAppointment(appointment: Appointment): CreatedAppointmentBody {
  return {
    mensagem: 'Agendamento realizado com sucesso',
    agendamento: {
      id: appointment.id,
      medico: appointment.doctorName,
      paciente: appointment.patient,
      data_horario: appointment.slot.toString(),
    },
  };
}
