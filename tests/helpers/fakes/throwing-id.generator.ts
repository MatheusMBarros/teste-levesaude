import type { IdGenerator } from '../../../src/application/ports/id-generator.port';

/** `IdGenerator` que sempre lança: simula uma falha inesperada de infraestrutura (500). */
export class ThrowingIdGenerator implements IdGenerator {
  constructor(readonly failure: Error = new Error('id generator exploded: segredo-interno')) {}

  generate(): string {
    throw this.failure;
  }
}
