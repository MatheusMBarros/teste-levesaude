import { assertNever } from './assert-never';

describe('assertNever', () => {
  it('lança erro informando o valor inesperado', () => {
    const unexpected = 'triagem' as never; // simula valor fora da união vindo de dado externo

    expect(() => assertNever(unexpected)).toThrow('Unexpected value: triagem');
  });
});
