/**
 * Relógio controlado para o `AnthropicTriageModel` (opções `sleep` e `now`): `sleep` não espera de
 * verdade, só registra a duração pedida e avança o tempo; `now` devolve o tempo simulado em ms.
 * Os métodos são propriedades arrow para poderem ser passados soltos (`{ sleep: clock.sleep }`).
 */
export class FakeClock {
  private currentMs: number;
  private readonly requestedSleeps: number[] = [];

  constructor(startMs = 1_781_085_600_000) {
    this.currentMs = startMs;
  }

  /** Durações (ms) pedidas a `sleep`, na ordem das chamadas. */
  get sleeps(): ReadonlyArray<number> {
    return this.requestedSleeps;
  }

  readonly now = (): number => this.currentMs;

  readonly sleep = (ms: number): Promise<void> => {
    this.requestedSleeps.push(ms);
    this.currentMs += ms;
    return Promise.resolve();
  };

  advance(ms: number): void {
    this.currentMs += ms;
  }
}
