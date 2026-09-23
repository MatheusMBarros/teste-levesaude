# ADR-008: Uma função Lambda `schedule` com roteamento por tabela e composition root por módulo

Status: aceito

## Contexto

`GET /agendas` precisa refletir as reservas feitas por `POST /agendamento` (D6), e os dados vivem
só em memória (D7, ADR-005). Funções Lambda distintas nunca compartilham memória: na AWS cada uma
tem seus próprios containers, e localmente o serverless-esbuild gera um bundle por função e o
serverless-offline v13 isola cada handler em worker threads (ADR-001). Os testes de integração
precisam, além disso, de estado isolado por teste (`docs/regras/testes.md`).

## Decisão

- **Uma função `schedule`** com dois eventos `http` (REST): `GET /agendas` e `POST /agendamento`
  (D15). `POST /triagem` terá função própria (Fase 5): não compartilha estado mutável.
- **Roteamento por tabela declarativa** (`RouteTable`, `src/interfaces/http/router.ts`), com chave
  `"<httpMethod> <resource>"` e valor igual a uma arrow que delega ao método do controller. A chave usa
  `event.resource` (rota declarada), não `event.path`. `createRouter` converte o evento em
  `HttpRequest`, procura a ação e serializa a resposta. Rota fora da tabela é erro de configuração:
  log `error` e 500 genérico. O handler é só a tabela.
- **Composition root em `src/main/container.ts`**: `createContainer(options?)` monta o grafo
  (seed → agendas → repositórios → casos de uso → controller) e `container` é criado **no escopo do
  módulo**. O container Lambda reaproveita o módulo entre invocações, e é isso que mantém o estado.
  O handler exporta `createScheduleHandler(container)` e
  `handler = createScheduleHandler(container)`. Os testes de integração chamam
  `createScheduleHandler(createContainer({ idGenerator, logWriter }))` e ganham estado novo e ids
  determinísticos sem `jest.mock`.
- `ContainerOptions` só aceita o que os testes precisam trocar: `idGenerator` (ids previsíveis no 201) e `logWriter` (capturar logs sem poluir a saída). O seed é sempre `DOCTORS_SEED`.

## Alternativas consideradas

- **Uma função por endpoint**: é o desenho mais comum, mas o `GET` não veria as reservas do `POST`
  (estado em processos diferentes). Descartada enquanto não houver armazenamento externo.
- **Roteamento por `switch`/`if` no handler**: equivalente em poder, mas mistura decisão com
  despacho e cresce a cada rota. A tabela é dado e é testável.
- **Proxy `{proxy+}` com um roteador HTTP (express, etc.)**: dependência extra e perde a
  declaração explícita das rotas no `serverless.yml`.
- **Container como singleton sem fábrica**: não daria para isolar o estado entre testes sem
  recarregar módulos (`jest.isolateModules`), o que é frágil.

## Consequências

- Os dois endpoints escalam juntos (mesma concorrência e memória), o que é aceitável aqui.
- O estado continua por container: duas instâncias quentes da função `schedule` na AWS têm agendas
  diferentes (limitação de D7, a documentar no README). Com um banco, a função pode ser dividida sem
  mudar controllers nem casos de uso.
- Importar o módulo do handler cria o container padrão. Isso é barato, sem I/O; o log só escreve
  quando há requisição.
- Rotas inexistentes nunca chegam à Lambda na AWS: o API Gateway responde com as `GatewayResponses`
  (D19). O 500 de rota ausente no roteador cobre só a divergência entre `serverless.yml` e a tabela.
- O roteador também é a rede de segurança da função: um try/catch final transforma uma ação que
  rejeite (ex.: método novo sem `@HandleHttpErrors`) em 500 genérico com JSON e CORS, em vez de erro
  da Lambda (502 do gateway, fora do formato D9).
- O roteador recebe um tipo de borda próprio (`ApiGatewayProxyEventInput`), não o
  `APIGatewayProxyEvent`: `headers` e `body` podem vir nulos ou ausentes (console da AWS,
  `serverless invoke`) e são normalizados em `toHttpRequest`, sem `as`. `requestContext`, `httpMethod`
  e `resource` continuam obrigatórios, porque o API Gateway sempre os envia. A compatibilidade com o
  tipo oficial é garantida pelo typecheck dos testes, que passam `APIGatewayProxyEvent` completos.
- O arquivo do handler é `handlers/schedule-handler.ts`, e não `schedule.handler.ts` como no padrão de
  sufixos. O runtime Node da Lambda (`aws-lambda-ric`, o mesmo que o serverless-offline embute) separa
  a string do handler com `/^([^.]*)\.(.*)$/`, ou seja, no **primeiro** ponto do nome do arquivo:
  `schedule.handler.handler` procuraria o módulo `schedule` e a propriedade `handler.handler`, e
  falharia com `Cannot find module 'schedule'` tanto no offline quanto na AWS. A exceção está em
  `docs/regras/typescript.md`.
