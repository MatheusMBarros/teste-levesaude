import { z } from 'zod';

import { ValidatedBody } from '../decorators/validate-body.decorator';
import { requiredOr } from './common.schema';

const SYMPTOMS_MIN_LENGTH = 10;
const SYMPTOMS_MAX_LENGTH = 2000;

/**
 * Payload de `POST /triagem` (contrato 3): `sintomas` com trim, 10 a 2000 caracteres. As mensagens
 * nunca repetem o relato (dado de saúde). Campos extras são descartados.
 */
export const triageSchema = z.object(
  {
    // `pipe`: o Zod 4 roda `min`/`max` mesmo após o erro de tipo quando a entrada tem `length`
    // (ex.: uma lista), o que geraria um segundo problema enganoso no 400.
    sintomas: z.string({ error: requiredOr('deve ser um texto') }).pipe(
      z
        .string()
        .trim()
        .min(SYMPTOMS_MIN_LENGTH, {
          error: `deve ter pelo menos ${String(SYMPTOMS_MIN_LENGTH)} caracteres`,
        })
        .max(SYMPTOMS_MAX_LENGTH, {
          error: `deve ter no máximo ${String(SYMPTOMS_MAX_LENGTH)} caracteres`,
        }),
    ),
  },
  { error: 'deve ser um objeto JSON' },
);

export type TriageBody = z.infer<typeof triageSchema>;

export const triageBody = new ValidatedBody(triageSchema);
