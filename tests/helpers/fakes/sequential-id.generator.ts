import type { IdGenerator } from '../../../src/application/ports/id-generator.port';

/** Gera ids determinísticos (`appointment-1`, `appointment-2`, ...) e conta as chamadas. */
export class SequentialIdGenerator implements IdGenerator {
  private count = 0;

  constructor(private readonly prefix = 'appointment') {}

  get calls(): number {
    return this.count;
  }

  generate(): string {
    this.count += 1;
    return `${this.prefix}-${String(this.count)}`;
  }
}
