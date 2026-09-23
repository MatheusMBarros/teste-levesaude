/**
 * Lista fechada das especialidades atendidas. Chaves em inglês (D16); valores são os textos do
 * contrato HTTP. É também o domínio de saída da triagem (Fase 5), com "Clínico Geral" como fallback.
 */
export const SPECIALTIES = {
  cardiologist: 'Cardiologista',
  dermatologist: 'Dermatologista',
  pediatrician: 'Pediatra',
  orthopedist: 'Ortopedista',
  generalPractitioner: 'Clínico Geral',
} as const;

export type Specialty = (typeof SPECIALTIES)[keyof typeof SPECIALTIES];
