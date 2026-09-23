import { SlotDateTime } from '../../../src/domain/value-objects/slot-date-time.value-object';

/**
 * Cria um `SlotDateTime` a partir de texto fixo de teste. Lança se o texto for inválido:
 * é dado de teste, então uma falha aqui é erro de quem escreveu o teste, não comportamento.
 */
export function slot(value: string): SlotDateTime {
  const result = SlotDateTime.create(value);
  if (!result.ok) {
    throw new Error(`Dado de teste inválido para SlotDateTime: "${value}"`);
  }
  return result.value;
}
