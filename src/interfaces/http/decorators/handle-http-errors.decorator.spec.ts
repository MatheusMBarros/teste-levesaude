import { z } from 'zod';

import { slot } from '../../../../tests/helpers/builders/slot';
import { captureLogs } from '../../../../tests/helpers/fakes/log-capture';
import { anHttpRequest } from '../../../../tests/helpers/http-request';
import type { Logger } from '../../../application/ports/logger.port';
import { SlotUnavailableError } from '../../../domain/errors/slot-unavailable.error';
import { JsonLogger } from '../../../infrastructure/logger/json.logger';
import type { HttpRequest } from '../http-request';
import type { ErrorBody, HttpResponse } from '../http-response';
import { DEFAULT_HEADERS, okResponse } from '../http-response';
import type { WithLogger } from './controller-method';
import { HandleHttpErrors } from './handle-http-errors.decorator';
import { ValidatedBody } from './validate-body.decorator';

interface ProbeBody {
  readonly status: 'ok';
}

type Behavior = (request: HttpRequest) => Promise<HttpResponse<ProbeBody>>;

class ProbeController implements WithLogger {
  constructor(
    readonly logger: Logger,
    private readonly behavior: Behavior,
  ) {}

  @HandleHttpErrors
  run(request: HttpRequest): Promise<HttpResponse<ProbeBody | ErrorBody>> {
    return this.behavior(request);
  }
}

const probeBody = new ValidatedBody(z.object({ nome: z.string() }));

/** Esquece o `@ValidateBody`: bug de programação que precisa virar 500 identificável no log. */
class ForgotValidationController implements WithLogger {
  constructor(readonly logger: Logger) {}

  @HandleHttpErrors
  create(request: HttpRequest): Promise<HttpResponse<{ readonly nome: string } | ErrorBody>> {
    return Promise.resolve(okResponse(probeBody.of(request)));
  }
}

const INTERNAL_ERROR: ErrorBody = {
  erro: 'Erro interno',
  mensagem: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
};

function makeSut(behavior: Behavior): {
  controller: ProbeController;
  logs: ReturnType<typeof captureLogs>;
} {
  const logs = captureLogs();
  const controller = new ProbeController(new JsonLogger(logs.write), behavior);
  return { controller, logs };
}

describe('HandleHttpErrors', () => {
  it('devolve a resposta do método quando nada falha', async () => {
    const expected = okResponse<ProbeBody>({ status: 'ok' });
    const { controller, logs } = makeSut(() => Promise.resolve(expected));

    const response = await controller.run(anHttpRequest());

    expect(response).toBe(expected);
    expect(logs.ofLevel('error')).toHaveLength(0);
  });

  it('responde 500 genérico quando o método rejeita', async () => {
    const { controller } = makeSut(() => Promise.reject(new Error('banco caiu')));

    const response = await controller.run(anHttpRequest());

    expect(response).toEqual({ statusCode: 500, headers: DEFAULT_HEADERS, body: INTERNAL_ERROR });
  });

  it('responde 500 genérico quando o método lança de forma síncrona', async () => {
    const { controller } = makeSut(() => {
      throw new TypeError('bug síncrono');
    });

    const response = await controller.run(anHttpRequest());

    expect(response).toEqual({ statusCode: 500, headers: DEFAULT_HEADERS, body: INTERNAL_ERROR });
  });

  it('responde 500 genérico quando o valor lançado não é um Error', async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- o cenário é justamente um valor não-Error rejeitado
    const { controller } = makeSut(() => Promise.reject('falha em texto'));

    const response = await controller.run(anHttpRequest());

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual(INTERNAL_ERROR);
  });

  it('não vaza a mensagem nem o stack da exceção na resposta', async () => {
    const failure = new Error('segredo-interno: senha=123');
    const { controller } = makeSut(() => Promise.reject(failure));

    const response = await controller.run(anHttpRequest());

    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain('segredo-interno');
    expect(serialized).not.toContain('senha');
    expect(serialized).not.toContain(String(failure.stack));
  });

  it('registra a falha em log de nível error com a mensagem original e o requestId', async () => {
    const { controller, logs } = makeSut(() => Promise.reject(new Error('banco caiu')));

    await controller.run(anHttpRequest({ requestId: 'req-500' }));

    const errors = logs.ofLevel('error');
    expect(errors).toHaveLength(1);
    expect(logs.text).toContain('banco caiu');
    expect(logs.text).toContain('req-500');
  });

  it('identifica no log o controller e o método onde a falha aconteceu', async () => {
    const { controller, logs } = makeSut(() => Promise.reject(new Error('banco caiu')));

    await controller.run(anHttpRequest());

    expect(logs.text).toContain('ProbeController.run');
  });

  it('inclui no log o code de um DomainError lançado por engano', async () => {
    const thrown = new SlotUnavailableError(1, slot('2026-06-10 09:00'));
    const { controller, logs } = makeSut(() => Promise.reject(thrown));

    const response = await controller.run(anHttpRequest());

    expect(response.statusCode).toBe(500);
    expect(logs.text).toContain('"code":"SLOT_UNAVAILABLE"');
  });

  it('responde 500 e aponta no log o método que usou of() sem @ValidateBody', async () => {
    const logs = captureLogs();
    const controller = new ForgotValidationController(new JsonLogger(logs.write));

    const response = await controller.create(anHttpRequest({ body: '{"nome":"Carlos"}' }));

    expect(response).toEqual({ statusCode: 500, headers: DEFAULT_HEADERS, body: INTERNAL_ERROR });
    expect(logs.ofLevel('error')).toHaveLength(1);
    expect(logs.text).toContain('ForgotValidationController.create');
    expect(logs.text).toContain('@ValidateBody');
  });
});
