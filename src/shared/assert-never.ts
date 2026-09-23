/**
 * Garante exaustividade em `switch` sobre uniões discriminadas: se um novo membro for
 * adicionado à união e não tratado, a chamada deixa de compilar.
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
