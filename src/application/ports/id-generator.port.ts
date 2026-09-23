/** Gera identificadores únicos de agendamento (UUID v4 em produção, D10). */
export interface IdGenerator {
  generate(): string;
}
