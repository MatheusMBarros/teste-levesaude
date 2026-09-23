import { z } from 'zod';

import { SlotDateTime } from '../../../domain/value-objects/slot-date-time.value-object';
import { ValidatedBody } from '../decorators/validate-body.decorator';
import { requiredOr } from './common.schema';

const PATIENT_MIN_LENGTH = 3;
const PATIENT_MAX_LENGTH = 120;

const slotDateTime = z
  .string({ error: requiredOr('deve ser um texto') })
  .transform((value, context) => {
    // A regra de data (D2) vive só no value object; sem trim (D22).
    const slot = SlotDateTime.create(value);
    if (!slot.ok) {
      context.addIssue({
        code: 'custom',
        message: 'deve estar no formato YYYY-MM-DD HH:mm e ser uma data válida',
      });
      return z.NEVER;
    }
    return slot.value;
  });

/** Payload de `POST /agendamento` (contrato 2, D12, D13, D2). Campos extras são descartados. */
export const createAppointmentSchema = z.object(
  {
    agendamento: z.object(
      {
        medico_id: z
          .number({ error: requiredOr('deve ser um número inteiro') })
          .int({ error: 'deve ser um número inteiro' })
          .positive({ error: 'deve ser maior que zero' }),
        paciente: z
          .string({ error: requiredOr('deve ser um texto') })
          .trim()
          .min(PATIENT_MIN_LENGTH, {
            error: `deve ter pelo menos ${String(PATIENT_MIN_LENGTH)} caracteres`,
          })
          .max(PATIENT_MAX_LENGTH, {
            error: `deve ter no máximo ${String(PATIENT_MAX_LENGTH)} caracteres`,
          }),
        data_horario: slotDateTime,
      },
      { error: requiredOr('deve ser um objeto') },
    ),
  },
  { error: 'deve ser um objeto JSON' },
);

export type CreateAppointmentBody = z.infer<typeof createAppointmentSchema>;

export const createAppointmentBody = new ValidatedBody(createAppointmentSchema);
