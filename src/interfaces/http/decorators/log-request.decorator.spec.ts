import { captureLogs } from '../../../../tests/helpers/fakes/log-capture';
import { anHttpRequest } from '../../../../tests/helpers/http-request';
import type { Logger } from '../../../application/ports/logger.port';
import { JsonLogger } from '../../../infrastructure/logger/json.logger';
import type { HttpRequest } from '../http-request';
import type { ErrorBody, HttpResponse } from '../http-response';
import { errorResponse, okResponse } from '../http-response';
import type { WithLogger } from './controller-method';
import { LogRequest } from './log-request.decorator';

interface ProbeBody {
  readonly status: 'ok';
}

class ProbeController implements WithLogger {
  readonly receivedRequests: HttpRequest[] = [];

  constructor(
    readonly logger: Logger,
    private readonly response: HttpResponse<ProbeBody | ErrorBody>,
  ) {}

  @LogRequest
  run(request: HttpRequest): Promise<HttpResponse<ProbeBody | ErrorBody>> {
    this.receivedRequests.push(request);
    return Promise.resolve(this.response);
  }
}

function makeSut(response: HttpResponse<ProbeBody | ErrorBody> = okResponse({ status: 'ok' })): {
  controller: ProbeController;
  logs: ReturnType<typeof captureLogs>;
} {
  const logs = captureLogs();
  const controller = new ProbeController(new JsonLogger(logs.write), response);
  return { controller, logs };
}

describe('LogRequest', () => {
  it('repassa a mesma requisição ao método e devolve a resposta sem alterá-la', async () => {
    const expected = okResponse<ProbeBody>({ status: 'ok' });
    const { controller } = makeSut(expected);
    const request = anHttpRequest();

    const response = await controller.run(request);

    expect(controller.receivedRequests).toEqual([request]);
    expect(controller.receivedRequests[0]).toBe(request);
    expect(response).toBe(expected);
  });

  it('registra uma linha info com requestId, método, rota e status da resposta', async () => {
    const { controller, logs } = makeSut();

    await controller.run(
      anHttpRequest({ requestId: 'req-42', method: 'GET', resource: '/agendas' }),
    );

    expect(logs.entries).toHaveLength(1);
    expect(logs.entries[0]).toMatchObject({
      level: 'info',
      requestId: 'req-42',
      method: 'GET',
      resource: '/agendas',
      statusCode: 200,
    });
  });

  it('registra a duração da requisição em milissegundos inteiros', async () => {
    const { controller, logs } = makeSut();

    await controller.run(anHttpRequest());

    const durationMs = logs.entries[0]?.durationMs;
    expect(Number.isInteger(durationMs)).toBe(true);
    expect(durationMs).toBeGreaterThanOrEqual(0);
  });

  it('registra o status de respostas de erro', async () => {
    const { controller, logs } = makeSut(
      errorResponse(400, { erro: 'Payload inválido', mensagem: 'inválido' }),
    );

    await controller.run(anHttpRequest({ requestId: 'req-400' }));

    expect(logs.entries).toContainEqual(
      expect.objectContaining({ requestId: 'req-400', statusCode: 400 }),
    );
  });
});
