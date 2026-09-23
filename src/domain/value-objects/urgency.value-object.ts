/**
 * Níveis de urgência da triagem, do menor para o maior. Os valores são os textos do contrato
 * HTTP (`urgencia`, contrato 3, ADR-006). Tupla `as const` pelo mesmo motivo de `SPECIALTIES`:
 * base do `enum` da ferramenta do LLM e do `z.enum` que valida a saída.
 */
export const URGENCY_LEVELS = ['baixa', 'media', 'alta', 'emergencia'] as const;

export type Urgency = (typeof URGENCY_LEVELS)[number];
