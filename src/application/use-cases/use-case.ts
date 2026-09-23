/**
 * Contrato comum dos casos de uso. Permite que controllers dependam da abstração e que
 * testes injetem implementações alternativas. Erros de negócio vêm em `TOutput` como
 * `Result`; a Promise só rejeita em falha inesperada (ADR-002).
 */
export interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}
