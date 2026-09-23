import { anApiGatewayEvent } from '../../../tests/helpers/api-gateway-event';
import { captureLogs } from '../../../tests/helpers/fakes/log-capture';
import { parseJsonBody } from '../../../tests/helpers/json-body';
import { JsonLogger } from '../../infrastructure/logger/json.logger';
import type { HttpRequest } from './http-request';
import { DEFAULT_HEADERS, createdResponse, okResponse } from './http-response';
import type { ApiGatewayProxyEventInput, RouteTable } from './router';
import { createRouter, toApiGatewayResult, toHttpRequest } from './router';

const INTERNAL_ERROR = {
  erro: 'Erro interno',
  mensagem: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
};

describe('toHttpRequest', () => {
  it('extrai requestId, método, rota declarada e corpo do evento', () => {
    const event = anApiGatewayEvent({
      method: 'POST',
      resource: '/agendamento',
      path: '/agendamento',
      body: '{"a":1}',
      requestId: 'req-123',
    });

    const request = toHttpRequest(event);

    expect(request).toMatchObject({
      requestId: 'req-123',
      method: 'POST',
      resource: '/agendamento',
      body: '{"a":1}',
    });
  });

  it('mantém body null quando o evento não tem corpo', () => {
    const request = toHttpRequest(anApiGatewayEvent({ method: 'GET', resource: '/agendas' }));

    expect(request.body).toBeNull();
  });

  it('normaliza os nomes dos headers para minúsculas e omite valores ausentes', () => {
    const event = anApiGatewayEvent({
      method: 'POST',
      resource: '/agendamento',
      headers: { 'Content-Type': 'application/json', 'X-Trace': 'abc', 'X-Vazio': undefined },
    });

    const request = toHttpRequest(event);

    expect(request.headers).toEqual({ 'content-type': 'application/json', 'x-trace': 'abc' });
  });

  it('aceita evento com headers nulos e sem body, como numa invocação pelo console da AWS', () => {
    const event: ApiGatewayProxyEventInput = {
      httpMethod: 'GET',
      resource: '/agendas',
      headers: null,
      requestContext: { requestId: 'req-console' },
    };

    const request = toHttpRequest(event);

    expect(request).toEqual({
      requestId: 'req-console',
      method: 'GET',
      resource: '/agendas',
      headers: {},
      body: null,
    });
  });
});

describe('toApiGatewayResult', () => {
  it('serializa o corpo em JSON e preserva status e headers', () => {
    const result = toApiGatewayResult(createdResponse({ id: 'appointment-1' }));

    expect(result.statusCode).toBe(201);
    expect(result.headers).toEqual(DEFAULT_HEADERS);
    expect(parseJsonBody(result)).toEqual({ id: 'appointment-1' });
  });
});

describe('createRouter', () => {
  function makeSut(): {
    router: ReturnType<typeof createRouter>;
    received: HttpRequest[];
    logs: ReturnType<typeof captureLogs>;
  } {
    const received: HttpRequest[] = [];
    const routes: RouteTable = {
      'GET /agendas': (request) => {
        received.push(request);
        return Promise.resolve(okResponse({ rota: 'listar' }));
      },
      'POST /agendamento': (request) => {
        received.push(request);
        return Promise.resolve(createdResponse({ rota: 'criar' }));
      },
    };
    const logs = captureLogs();
    const router = createRouter(routes, new JsonLogger(logs.write));
    return { router, received, logs };
  }

  it('despacha pela chave "<método> <resource>" e serializa a resposta da ação', async () => {
    const { router, received } = makeSut();

    const result = await router(
      anApiGatewayEvent({ method: 'POST', resource: '/agendamento', requestId: 'req-1' }),
    );

    expect(result.statusCode).toBe(201);
    expect(parseJsonBody(result)).toEqual({ rota: 'criar' });
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ requestId: 'req-1', resource: '/agendamento' });
  });

  it('roteia pela rota declarada (resource), não pelo path concreto', async () => {
    const { router } = makeSut();

    const result = await router(
      anApiGatewayEvent({ method: 'GET', resource: '/agendas', path: '/dev/agendas' }),
    );

    expect(parseJsonBody(result)).toEqual({ rota: 'listar' });
  });

  it.each([
    ['rota inexistente', 'GET', '/triagem'],
    ['método não mapeado para a rota', 'DELETE', '/agendas'],
  ])(
    'responde 500 genérico com headers padrão e registra erro para %s',
    async (_label, method, resource) => {
      const { router, received, logs } = makeSut();

      const result = await router(anApiGatewayEvent({ method, resource }));

      expect(result.statusCode).toBe(500);
      expect(result.headers).toEqual(DEFAULT_HEADERS);
      expect(parseJsonBody(result)).toEqual(INTERNAL_ERROR);
      expect(received).toHaveLength(0);
      expect(logs.ofLevel('error')).toHaveLength(1);
      expect(logs.text).toContain(resource);
    },
  );

  it('responde 500 genérico com JSON e CORS e registra erro quando a ação rejeita', async () => {
    const logs = captureLogs();
    const router = createRouter(
      { 'GET /agendas': () => Promise.reject(new Error('segredo-interno')) },
      new JsonLogger(logs.write),
    );

    const result = await router(
      anApiGatewayEvent({ method: 'GET', resource: '/agendas', requestId: 'req-falha' }),
    );

    expect(result.statusCode).toBe(500);
    expect(result.headers).toEqual(DEFAULT_HEADERS);
    expect(parseJsonBody(result)).toEqual(INTERNAL_ERROR);
    expect(result.body).not.toContain('segredo-interno');
    expect(logs.ofLevel('error')).toContainEqual(
      expect.objectContaining({
        message: 'Unhandled error in router',
        requestId: 'req-falha',
        method: 'GET',
        resource: '/agendas',
      }),
    );
    expect(logs.text).toContain('segredo-interno');
  });
});
