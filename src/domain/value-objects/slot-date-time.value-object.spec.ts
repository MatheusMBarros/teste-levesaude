import { expectErr, expectOk } from '../../../tests/helpers/result-assertions';
import { InvalidSlotDateTimeError } from '../errors/invalid-slot-date-time.error';
import { SlotDateTime } from './slot-date-time.value-object';

describe('SlotDateTime', () => {
  describe('create — valores aceitos', () => {
    it('aceita data-horário no formato YYYY-MM-DD HH:mm', () => {
      const result = SlotDateTime.create('2026-06-10 09:00');

      expect(result.ok).toBe(true);
    });

    it.each(['2026-06-10 00:00', '2026-06-10 23:59'])('aceita o horário limite %s', (value) => {
      const result = SlotDateTime.create(value);

      expect(result.ok).toBe(true);
    });

    it.each(['2028-02-29 10:00', '2000-02-29 10:00'])(
      'aceita 29 de fevereiro em ano bissexto (%s)',
      (value) => {
        const result = SlotDateTime.create(value);

        expect(result.ok).toBe(true);
      },
    );

    it.each(['2026-01-31 10:00', '2026-04-30 10:00', '2026-12-31 10:00'])(
      'aceita o último dia do mês (%s)',
      (value) => {
        const result = SlotDateTime.create(value);

        expect(result.ok).toBe(true);
      },
    );

    it('aceita datas no passado (D3)', () => {
      const result = SlotDateTime.create('2020-01-01 08:00');

      expect(result.ok).toBe(true);
    });
  });

  describe('create — dia inexistente', () => {
    it.each([
      ['2026-02-30 10:00', '30 de fevereiro'],
      ['2026-04-31 10:00', '31 de abril'],
      ['2026-02-29 10:00', '29 de fevereiro em ano não bissexto'],
      ['1900-02-29 10:00', '29 de fevereiro em ano secular não bissexto'],
      ['2026-01-32 10:00', 'dia 32'],
    ])('rejeita %s (%s)', (value) => {
      const result = SlotDateTime.create(value);

      expect(result.ok).toBe(false);
    });
  });

  describe('create — campos fora do intervalo', () => {
    it.each([
      ['2026-00-10 10:00', 'mês 00'],
      ['2026-13-10 10:00', 'mês 13'],
      ['2026-06-00 10:00', 'dia 00'],
      ['2026-06-10 24:00', 'hora 24'],
      ['2026-06-10 23:60', 'minuto 60'],
    ])('rejeita %s (%s)', (value) => {
      const result = SlotDateTime.create(value);

      expect(result.ok).toBe(false);
    });
  });

  describe('create — formato inválido', () => {
    it.each([
      ['2026-06-10T09:00', 'separador T (ISO)'],
      ['2026-6-10 09:00', 'mês sem zero à esquerda'],
      ['2026-06-10 9:00', 'hora sem zero à esquerda'],
      ['2026-06-10 09:00:00', 'com segundos'],
      ['2026-06-10 09:00Z', 'com timezone'],
      ['', 'texto vazio'],
      [' 2026-06-10 09:00', 'espaço no início (D22, sem trim)'],
      ['2026-06-10 09:00 ', 'espaço no fim (D22, sem trim)'],
      ['10/06/2026 09:00', 'formato brasileiro'],
      ['2026-06-10', 'sem horário'],
    ])('rejeita "%s" (%s)', (value) => {
      const result = SlotDateTime.create(value);

      expect(result.ok).toBe(false);
    });
  });

  describe('create — erro', () => {
    it('retorna InvalidSlotDateTimeError com code INVALID_SLOT_DATE_TIME e o valor recebido', () => {
      const error = expectErr(SlotDateTime.create('2026-02-30 10:00'));

      expect(error).toBeInstanceOf(InvalidSlotDateTimeError);
      expect(error.code).toBe('INVALID_SLOT_DATE_TIME');
      expect(error.value).toBe('2026-02-30 10:00');
    });
  });

  describe('toString', () => {
    it('devolve exatamente o texto recebido em create', () => {
      const slot = expectOk(SlotDateTime.create('2026-06-10 09:00'));

      expect(slot.toString()).toBe('2026-06-10 09:00');
    });
  });

  describe('equals', () => {
    it('considera iguais duas instâncias criadas a partir do mesmo texto', () => {
      const first = expectOk(SlotDateTime.create('2026-06-10 09:00'));
      const second = expectOk(SlotDateTime.create('2026-06-10 09:00'));

      expect(first.equals(second)).toBe(true);
    });

    it('considera diferentes instâncias de horários distintos', () => {
      const first = expectOk(SlotDateTime.create('2026-06-10 09:00'));
      const second = expectOk(SlotDateTime.create('2026-06-10 10:00'));

      expect(first.equals(second)).toBe(false);
    });
  });

  describe('isBefore', () => {
    it.each([
      ['2026-06-10 09:00', '2026-06-10 10:00', 'hora anterior no mesmo dia'],
      ['2026-06-10 09:00', '2026-06-10 09:01', 'minuto anterior'],
      ['2026-06-10 23:59', '2026-06-11 00:00', 'dia anterior'],
      ['2026-05-31 10:00', '2026-06-01 08:00', 'mês anterior'],
      ['2025-12-31 23:59', '2026-01-01 00:00', 'ano anterior'],
    ])('considera %s antes de %s (%s)', (earlier, later) => {
      const result = SlotDateTime.create(earlier);
      const other = SlotDateTime.create(later);

      expect(expectOk(result).isBefore(expectOk(other))).toBe(true);
    });

    it('não considera um horário antes de um horário anterior a ele', () => {
      const later = expectOk(SlotDateTime.create('2026-06-10 10:00'));
      const earlier = expectOk(SlotDateTime.create('2026-06-10 09:00'));

      expect(later.isBefore(earlier)).toBe(false);
    });

    it('não considera um horário antes de si mesmo', () => {
      const first = expectOk(SlotDateTime.create('2026-06-10 09:00'));
      const second = expectOk(SlotDateTime.create('2026-06-10 09:00'));

      expect(first.isBefore(second)).toBe(false);
    });
  });
});
