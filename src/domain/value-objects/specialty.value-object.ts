/**
 * Lista fechada das especialidades atendidas. Os valores são os textos do contrato HTTP (ADR-006).
 * Tupla `as const` para servir direto de base ao `enum` da ferramenta da triagem e ao `z.enum`
 * que valida a saída do LLM contra a lista recebida por requisição (ADR-010). "Clínico Geral" é a escolha para
 * casos vagos por regra do prompt (ADR-011), não por fallback no código.
 */
export const SPECIALTIES = [
  'Cardiologista',
  'Dermatologista',
  'Pediatra',
  'Ortopedista',
  'Clínico Geral',
] as const;

export type Specialty = (typeof SPECIALTIES)[number];
