import { inspect } from 'node:util';

import type { Result } from '../../src/shared/result';

/** Extrai o valor de um `Result` de sucesso; falha o teste se for erro. */
export function expectOk<T, E>(result: Result<T, E>): T {
  if (!result.ok) {
    throw new Error(`Esperava Result ok, recebeu err: ${inspect(result.error)}`);
  }
  return result.value;
}

/** Extrai o erro de um `Result` de falha; falha o teste se for sucesso. */
export function expectErr<T, E>(result: Result<T, E>): E {
  if (result.ok) {
    throw new Error(`Esperava Result err, recebeu ok: ${inspect(result.value)}`);
  }
  return result.error;
}
