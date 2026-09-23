import type { Result } from '../../shared/result';
import type { InvalidSlotDateTimeError } from '../errors/invalid-slot-date-time.error';

/**
 * Data-horário de um slot de agenda no formato `YYYY-MM-DD HH:mm`, **sem timezone**
 * (horário local da clínica, D2). Imutável e auto-protegido: só existe instância válida.
 *
 * Regras de `create`:
 * - casa exatamente `^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$` (sem trim, sem segundos, sem `T`/`Z`);
 * - mês 01–12, dia existente no mês (considera ano bissexto), hora 00–23, minuto 00–59;
 * - não usa `Date` com timezone do processo: a validação é aritmética sobre os campos;
 * - datas no passado são aceitas (D3).
 */
export class SlotDateTime {
  private constructor(private readonly value: string) {}

  static create(value: string): Result<SlotDateTime, InvalidSlotDateTimeError> {
    // Stub da etapa de contratos (Fase 2); implementado pelo dev-backend via TDD.
    // eslint-disable-next-line @typescript-eslint/no-meaningless-void-operator -- stub da etapa de contratos; removido na implementação (TDD)
    void value;
    throw new Error('Not implemented');
  }

  equals(other: SlotDateTime): boolean {
    // eslint-disable-next-line @typescript-eslint/no-meaningless-void-operator -- stub da etapa de contratos; removido na implementação (TDD)
    void [other, this.value];
    throw new Error('Not implemented');
  }

  /** Devolve o texto canônico `YYYY-MM-DD HH:mm`, idêntico ao recebido em `create`. */
  toString(): string {
    // eslint-disable-next-line @typescript-eslint/no-meaningless-void-operator -- stub da etapa de contratos; removido na implementação (TDD)
    void this.value;
    throw new Error('Not implemented');
  }
}
