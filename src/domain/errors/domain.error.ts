/**
 * Base de todos os erros de negócio. Erros de domínio são **valores** retornados em
 * `Result` (ADR-002), não exceções. Estende `Error` apenas para ter `name`/`stack` úteis
 * em log caso algum seja lançado por engano.
 *
 * O `message` é diagnóstico técnico (inglês, para logs). Textos ao usuário (`erro`/`mensagem`)
 * pertencem ao mapeamento HTTP, não ao domínio.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
