/** Campos de `agendamento` no contrato 2, com tipos abertos para testar payloads inválidos. */
export type AppointmentPayloadFields = Readonly<Record<string, unknown>>;

export interface AppointmentPayload {
  readonly agendamento: AppointmentPayloadFields;
}

const ENUNCIADO_FIELDS = {
  medico_id: 1,
  paciente: 'Carlos Almeida',
  data_horario: '2026-06-10 09:00',
} as const;

/**
 * Payload de `POST /agendamento`. Sem argumentos é o payload **do enunciado**; os campos passados
 * substituem (ou acrescentam) chaves de `agendamento`.
 * Uso: `anAppointmentPayload({ medico_id: '1' })`.
 */
export function anAppointmentPayload(overrides: AppointmentPayloadFields = {}): AppointmentPayload {
  return { agendamento: { ...ENUNCIADO_FIELDS, ...overrides } };
}

/** Payload do enunciado sem o campo informado (para testar campo ausente). */
export function anAppointmentPayloadWithout(
  field: keyof typeof ENUNCIADO_FIELDS,
): AppointmentPayload {
  return {
    agendamento: Object.fromEntries(
      Object.entries(ENUNCIADO_FIELDS).filter(([name]) => name !== field),
    ),
  };
}
