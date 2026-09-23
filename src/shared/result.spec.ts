import { err, ok } from './result';

describe('Result', () => {
  it('ok encapsula o valor de sucesso', () => {
    const result = ok(42);

    expect(result).toEqual({ ok: true, value: 42 });
  });

  it('err encapsula o erro', () => {
    const result = err('falhou');

    expect(result).toEqual({ ok: false, error: 'falhou' });
  });
});
