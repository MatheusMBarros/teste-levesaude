import { z } from 'zod';

import type {
  TriageClassification,
  TriageRequest,
} from '../../application/ports/triage-model.port';
import { URGENCY_LEVELS } from '../../domain/value-objects/urgency.value-object';

/**
 * Validação da entrada que o modelo passou à ferramenta `submit_triage`, montada **por requisição**
 * com a lista recebida na porta (`allowedSpecialties`): é o que torna honesta a promessa de
 * `TriageClassification` ("`specialty` pertence a `allowedSpecialties`"). Segunda barreira depois
 * do `enum` do `input_schema` (a tool usa `strict: false`, ADR-010): especialidade fora da lista,
 * urgência desconhecida, justificativa vazia/longa ou campo extra tornam a saída inválida
 * (retentativa, depois 502).
 *
 * Tamanho da justificativa: o prompt pede até 300 caracteres, mas o schema aceita até 500 de
 * propósito. Modelos não contam caracteres com precisão; um estouro pequeno ainda é uma resposta
 * útil e não deve gastar retentativa nem virar 502. O teto de 500 só barra saída claramente fora
 * do combinado.
 */
export function triageOutputSchema(
  allowed: TriageRequest['allowedSpecialties'],
): z.ZodType<TriageClassification> {
  return z
    .object({
      specialty: z.enum(allowed),
      urgency: z.enum(URGENCY_LEVELS),
      rationale: z.string().trim().min(1).max(500),
    })
    .strict();
}
