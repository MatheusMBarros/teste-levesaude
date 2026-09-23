import type { APIGatewayProxyEvent, APIGatewayProxyEventHeaders } from 'aws-lambda';

export interface ApiGatewayEventOptions {
  readonly method: string;
  /** Rota declarada no API Gateway (`/agendas`); é a chave do roteamento (D15). */
  readonly resource: string;
  /** Path concreto; por padrão igual ao `resource`. */
  readonly path?: string;
  readonly body?: string | null;
  /** Headers como o API Gateway os entrega (nomes com a caixa original; valor pode faltar). */
  readonly headers?: Readonly<Record<string, string | undefined>>;
  readonly requestId?: string;
}

/**
 * Evento REST (`APIGatewayProxyEvent`) completo, como o API Gateway entrega à Lambda em integração
 * proxy. Todos os campos obrigatórios do tipo são preenchidos: nenhuma asserção `as`.
 */
export function anApiGatewayEvent(options: ApiGatewayEventOptions): APIGatewayProxyEvent {
  const headers: APIGatewayProxyEventHeaders = { ...options.headers };
  const path = options.path ?? options.resource;

  return {
    body: options.body ?? null,
    headers,
    multiValueHeaders: Object.fromEntries(
      Object.entries(headers).map(([name, value]) => [
        name,
        value === undefined ? undefined : [value],
      ]),
    ),
    httpMethod: options.method,
    isBase64Encoded: false,
    path,
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    resource: options.resource,
    requestContext: {
      accountId: '123456789012',
      apiId: 'test-api-id',
      authorizer: undefined,
      protocol: 'HTTP/1.1',
      httpMethod: options.method,
      identity: {
        accessKey: null,
        accountId: null,
        apiKey: null,
        apiKeyId: null,
        caller: null,
        clientCert: null,
        cognitoAuthenticationProvider: null,
        cognitoAuthenticationType: null,
        cognitoIdentityId: null,
        cognitoIdentityPoolId: null,
        principalOrgId: null,
        sourceIp: '127.0.0.1',
        user: null,
        userAgent: 'jest',
        userArn: null,
      },
      path: `/dev${path}`,
      stage: 'dev',
      requestId: options.requestId ?? 'test-request-id',
      requestTimeEpoch: 1781085600000,
      resourceId: 'test-resource-id',
      resourcePath: options.resource,
    },
  };
}

export interface JsonPostOptions {
  /** Substitui os headers padrão (`Content-Type: application/json`); `{}` envia sem headers. */
  readonly headers?: Readonly<Record<string, string>>;
  readonly requestId?: string;
}

/** `POST` com o payload serializado em JSON. */
export function aJsonPostEvent(
  resource: string,
  payload: unknown,
  options: JsonPostOptions = {},
): APIGatewayProxyEvent {
  return anApiGatewayEvent({
    method: 'POST',
    resource,
    body: JSON.stringify(payload),
    headers: options.headers ?? { 'Content-Type': 'application/json' },
    ...(options.requestId === undefined ? {} : { requestId: options.requestId }),
  });
}
