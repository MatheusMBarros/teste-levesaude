import type { Result } from '../../shared/result';
import { err, ok } from '../../shared/result';
import { InvalidSlotDateTimeError } from '../errors/invalid-slot-date-time.error';

const FORMAT = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

const THIRTY_DAY_MONTHS: ReadonlySet<number> = new Set([4, 6, 9, 11]);

interface DateTimeFields {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

// Só é chamada após o FORMAT casar, então as posições de cada campo são fixas.
function parseFields(value: string): DateTimeFields {
  const field = (start: number, end: number): number => Number(value.slice(start, end));
  return {
    year: field(0, 4),
    month: field(5, 7),
    day: field(8, 10),
    hour: field(11, 13),
    minute: field(14, 16),
  };
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return THIRTY_DAY_MONTHS.has(month) ? 30 : 31;
}

function isRealDateTime({ year, month, day, hour, minute }: DateTimeFields): boolean {
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month) &&
    hour <= 23 &&
    minute <= 59
  );
}

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
    if (!FORMAT.test(value) || !isRealDateTime(parseFields(value))) {
      return err(new InvalidSlotDateTimeError(value));
    }
    return ok(new SlotDateTime(value));
  }

  equals(other: SlotDateTime): boolean {
    return this.value === other.value;
  }

  /** Devolve o texto canônico `YYYY-MM-DD HH:mm`, idêntico ao recebido em `create`. */
  toString(): string {
    return this.value;
  }
}
