import type { Result } from './result';
import { err, ok } from './result';

function describeResult(result: Result<number, string>): string {
  if (result.ok) {
    return `valor ${String(result.value)}`;
  }
  return `erro ${result.error}`;
}

describe('Result', () => {
  it('ok encapsula o valor de sucesso', () => {
    const result = ok(42);

    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('err encapsula o erro', () => {
    const result = err('falhou');

    expect(result).toEqual({ ok: false, error: 'falhou' });
  });

  it('permite acessar value após estreitar por result.ok === true', () => {
    const description = describeResult(ok(42));

    expect(description).toBe('valor 42');
  });

  it('permite acessar error após estreitar por result.ok === false', () => {
    const description = describeResult(err('falhou'));

    expect(description).toBe('erro falhou');
  });
});
