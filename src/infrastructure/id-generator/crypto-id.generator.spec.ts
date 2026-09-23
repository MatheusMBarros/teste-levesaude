import { CryptoIdGenerator } from './crypto-id.generator';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('CryptoIdGenerator', () => {
  it('gera um UUID v4', () => {
    const sut = new CryptoIdGenerator();

    const id = sut.generate();

    expect(id).toMatch(UUID_V4);
  });

  it('gera ids distintos a cada chamada', () => {
    const sut = new CryptoIdGenerator();

    const ids = Array.from({ length: 100 }, () => sut.generate());

    expect(new Set(ids).size).toBe(100);
  });
});
