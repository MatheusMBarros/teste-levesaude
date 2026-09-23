/**
 * Lista fechada das especialidades atendidas. Os valores são os textos do contrato HTTP (ADR-006).
 * Tupla `as const` para servir direto de base a `z.enum(SPECIALTIES)` na triagem (Fase 5), que
 * restringe a saída do LLM a esta lista com "Clínico Geral" como fallback.
 */
export const SPECIALTIES = [
  'Cardiologista',
  'Dermatologista',
  'Pediatra',
  'Ortopedista',
  'Clínico Geral',
] as const;

export type Specialty = (typeof SPECIALTIES)[number];
