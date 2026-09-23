import type { z } from 'zod';

import type { Result } from '../../../shared/result';
import { err, ok } from '../../../shared/result';
import { invalidPayloadResponse } from '../errors/error-responses';
import type { HttpRequest } from '../http-request';
import type { ErrorAwareMethod } from './controller-method';

/** Problema de validação de um campo do corpo; vira um item de `detalhes` no 400 (D8). */
export interface ValidationIssue {
  /** Caminho com pontos (`agendamento.medico_id`); `body` quando o problema é o corpo inteiro. */
  readonly field: string;
  readonly problem: string;
}

const ROOT_FIELD = 'body';

/** Bug de programação: o método leu o corpo validado sem ter `@ValidateBody` aplicado. */
export class BodyNotValidatedError extends Error {
  constructor() {
    super('No validated body for this request: apply @ValidateBody to the controller method');
    this.name = 'BodyNotValidatedError';
  }
}

function rootIssue(problem: string): Result<never, ReadonlyArray<ValidationIssue>> {
  return err([{ field: ROOT_FIELD, problem }]);
}

function toValidationIssue(issue: z.core.$ZodIssue): ValidationIssue {
  const field = issue.path.map(String).join('.');
  return { field: field === '' ? ROOT_FIELD : field, problem: issue.message };
}

/**
 * Token tipado que liga um schema Zod ao método decorado (ADR-007). `validate` (usado pelo
 * `@ValidateBody`) guarda o corpo validado por **instância** de requisição; `of` o devolve já
 * tipado, sem asserção. O valor fica embrulhado para distinguir "não validado" de um corpo
 * cujo tipo admita `undefined`.
 */
export class ValidatedBody<TBody> {
  private readonly validated = new WeakMap<HttpRequest, { readonly value: TBody }>();

  constructor(private readonly schema: z.ZodType<TBody>) {}

  // O Content-Type não é verificado (D24): o corpo é sempre lido como JSON.
  validate(request: HttpRequest): Result<TBody, ReadonlyArray<ValidationIssue>> {
    const { body } = request;
    if (body === null || body.trim() === '') {
      return rootIssue('é obrigatório');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      return rootIssue('deve ser um JSON válido');
    }

    const result = this.schema.safeParse(parsed);
    if (!result.success) {
      return err(result.error.issues.map(toValidationIssue));
    }
    this.validated.set(request, { value: result.data });
    return ok(result.data);
  }

  of(request: HttpRequest): TBody {
    const entry = this.validated.get(request);
    if (entry === undefined) {
      throw new BodyNotValidatedError();
    }
    return entry.value;
  }
}

export type ValidateBodyDecorator = <This, TSuccess>(
  method: ErrorAwareMethod<This, TSuccess>,
  context: ClassMethodDecoratorContext<This, ErrorAwareMethod<This, TSuccess>>,
) => ErrorAwareMethod<This, TSuccess>;

/** Responde 400 antes de chamar o método quando o corpo não passa no schema do token. */
export function ValidateBody<TBody>(token: ValidatedBody<TBody>): ValidateBodyDecorator {
  return <This, TSuccess>(method: ErrorAwareMethod<This, TSuccess>) =>
    function validatingMethod(this: This, request: HttpRequest) {
      const validation = token.validate(request);
      if (!validation.ok) {
        const details = validation.error.map(({ field, problem }) => ({
          campo: field,
          problema: problem,
        }));
        return Promise.resolve(invalidPayloadResponse(details));
      }
      return method.call(this, request);
    };
}
