/** Mensagem de campo ausente, comum a todos os payloads (D8). */
export const REQUIRED = 'é obrigatório';

/**
 * Mensagem de erro de tipo que distingue campo ausente de tipo errado: só `undefined` é
 * "obrigatório"; `null` é valor presente com tipo errado.
 */
export function requiredOr(typeProblem: string): (issue: { readonly input?: unknown }) => string {
  return (issue) => (issue.input === undefined ? REQUIRED : typeProblem);
}
