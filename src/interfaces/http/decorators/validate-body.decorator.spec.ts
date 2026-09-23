import { z } from 'zod';

import { anHttpRequest, aJsonHttpRequest } from '../../../../tests/helpers/http-request';
import type { HttpRequest } from '../http-request';
import type { ErrorBody, HttpResponse } from '../http-response';
import { DEFAULT_HEADERS, okResponse } from '../http-response';
import { ValidateBody, ValidatedBody } from './validate-body.decorator';

const probeSchema = z.object(
  {
    pedido: z.object(
      { quantidade: z.number({ error: 'deve ser um número' }) },
      { error: 'deve ser um objeto' },
    ),
  },
  { error: 'deve ser um objeto JSON' },
);

type ProbeBody = z.infer<typeof probeSchema>;

const probeBody = new ValidatedBody(probeSchema);

/** Controller mínimo: registra o que recebeu e devolve o corpo validado. */
class ProbeController {
  readonly receivedRequests: HttpRequest[] = [];
  readonly receivedBodies: ProbeBody[] = [];

  @ValidateBody(probeBody)
  handle(request: HttpRequest): Promise<HttpResponse<ProbeBody | ErrorBody>> {
    this.receivedRequests.push(request);
    const body = probeBody.of(request);
    this.receivedBodies.push(body);
    return Promise.resolve(okResponse(body));
  }
}

function invalidPayload(campo: string, problema: string): ErrorBody {
  return {
    erro: 'Payload inválido',
    mensagem: 'O corpo da requisição é inválido. Verifique os detalhes.',
    detalhes: [{ campo, problema }],
  };
}

describe('ValidateBody', () => {
  it('chama o método com a mesma requisição e entrega o corpo validado via of()', async () => {
    const controller = new ProbeController();
    const request = aJsonHttpRequest({ pedido: { quantidade: 2 } });

    const response = await controller.handle(request);

    expect(response.statusCode).toBe(200);
    expect(controller.receivedRequests).toHaveLength(1);
    expect(controller.receivedRequests[0]).toBe(request);
    expect(controller.receivedBodies).toEqual([{ pedido: { quantidade: 2 } }]);
  });

  it.each([
    ['ausente (null)', null],
    ['vazio', ''],
    ['só com espaços', '   \n\t'],
  ])(
    'responde 400 "body é obrigatório" sem chamar o método quando o corpo está %s',
    async (_label, body) => {
      const controller = new ProbeController();

      const response = await controller.handle(anHttpRequest({ body }));

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual(invalidPayload('corpo', 'é obrigatório'));
      expect(controller.receivedRequests).toHaveLength(0);
    },
  );

  it.each(['{', '{"pedido":', 'não é json', "{'pedido': 1}"])(
    'responde 400 "body deve ser um JSON válido" para o corpo malformado %j',
    async (body) => {
      const controller = new ProbeController();

      const response = await controller.handle(anHttpRequest({ body }));

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual(invalidPayload('corpo', 'deve ser um JSON válido'));
      expect(controller.receivedRequests).toHaveLength(0);
    },
  );

  it('responde 400 apontando o campo pelo caminho com pontos quando o schema rejeita', async () => {
    const controller = new ProbeController();

    const response = await controller.handle(aJsonHttpRequest({ pedido: { quantidade: 'dois' } }));

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual(invalidPayload('pedido.quantidade', 'deve ser um número'));
    expect(controller.receivedRequests).toHaveLength(0);
  });

  it('usa "corpo" como campo quando o erro é na raiz do corpo', async () => {
    const controller = new ProbeController();

    const response = await controller.handle(aJsonHttpRequest([1, 2, 3]));

    expect(response.body).toEqual(invalidPayload('corpo', 'deve ser um objeto JSON'));
  });

  it('responde 400 com os headers JSON e CORS padrão', async () => {
    const controller = new ProbeController();

    const response = await controller.handle(anHttpRequest({ body: null }));

    expect(response.headers).toEqual(DEFAULT_HEADERS);
  });

  it('não exige Content-Type JSON: valida o corpo qualquer que seja o header (D24)', async () => {
    const controller = new ProbeController();
    const request = aJsonHttpRequest(
      { pedido: { quantidade: 2 } },
      { headers: { 'content-type': 'application/x-www-form-urlencoded' } },
    );

    const response = await controller.handle(request);

    expect(response.statusCode).toBe(200);
  });
});

describe('ValidatedBody', () => {
  it('lança erro citando @ValidateBody quando of() é chamado sem a validação', () => {
    const request = aJsonHttpRequest({ pedido: { quantidade: 2 } });

    const act = (): ProbeBody => probeBody.of(request);

    expect(act).toThrow(/@ValidateBody/);
  });

  it('associa o corpo validado à instância da requisição, não ao conteúdo', async () => {
    const controller = new ProbeController();
    const validated = aJsonHttpRequest({ pedido: { quantidade: 2 } });
    const sameContentOtherInstance = aJsonHttpRequest({ pedido: { quantidade: 2 } });
    await controller.handle(validated);

    const act = (): ProbeBody => probeBody.of(sameContentOtherInstance);

    expect(act).toThrow(/@ValidateBody/);
  });
});
