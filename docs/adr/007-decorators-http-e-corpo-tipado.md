# ADR-007: Decorators TS 5 na camada HTTP e entrega tipada do corpo validado

Status: aceito

## Contexto

O enunciado lista como diferencial "decorators para validação, logging e tratamento de erros
HTTP". Os decorators precisam seguir o padrão TC39 do TS 5 (sem `experimentalDecorators`), sem
`any` e sem `as` (`docs/regras/typescript.md`).

No padrão TC39, o compilador exige que o substituto devolvido por um decorator de método seja
atribuível ao tipo **declarado** do método (TS1270). Ou seja, um decorator não muda a assinatura do
método. Isso cria dois problemas:

1. Se o método declara `createAppointment(request: HttpRequest<CreateAppointmentBody>)`, quem o
   chama (o roteador, que só tem o corpo bruto) não compila sem `as` ou sem explorar a bivariância
   de parâmetros de métodos, que é um furo conhecido do TS.
2. Se um decorator pode responder erro (400/500), o tipo de retorno do método precisa admitir o
   corpo de erro.

## Decisão

- **Decorators nativos TS 5**, não middleware. Três decorators de método em
  `src/interfaces/http/decorators/`: `@LogRequest`, `@HandleHttpErrors`, `@ValidateBody(body)`.
- **O método recebe a requisição bruta** (`HttpRequest`, com `body: string | null`) e lê o corpo
  validado por um **token tipado** criado a partir do schema Zod:

  ```ts
  export const createAppointmentBody = new ValidatedBody(createAppointmentSchema);

  @LogRequest
  @HandleHttpErrors
  @ValidateBody(createAppointmentBody)
  async createAppointment(
    request: HttpRequest,
  ): Promise<HttpResponse<CreatedAppointmentBody | ErrorBody>> {
    const { agendamento } = createAppointmentBody.of(request); // CreateAppointmentBody
  ```

  `ValidatedBody<TBody>` infere `TBody` do schema (`z.ZodType<TBody>`). `validate(request)`
  (usado pelo decorator) guarda o resultado num `WeakMap<HttpRequest, { readonly value: TBody }>` interno (o envelope
  distingue "não validado" de um corpo cujo tipo admite `undefined`), e `of(request)` devolve
  `TBody` sem asserção. Chamar `of` num método sem o decorator lança `BodyNotValidatedError`
  (bug), que vira 500; o `@HandleHttpErrors` registra no log `Controller.método` e a mensagem
  pedindo para aplicar `@ValidateBody`. Isso falha de forma visível, em vez de deixar dado não validado
  chegar ao caso de uso. Todo o caminho é verificado pelo compilador.

- **Retorno declara `Sucesso | ErrorBody`.** Os decorators são genéricos em
  `ErrorAwareMethod<This, TSuccess>` (`controller-method.ts`). Um método que omita `ErrorBody` no
  retorno não compila.
- **Logger via `this`.** Decorators são avaliados na definição da classe, antes do container.
  `@LogRequest` e `@HandleHttpErrors` exigem `This extends WithLogger` e usam `this.logger`,
  injetado no construtor do controller. Não há logger global.
- **Ordem** (de cima para baixo = de fora para dentro): `@LogRequest` → `@HandleHttpErrors` →
  `@ValidateBody`. O log mede a duração total e sempre enxerga um status, inclusive o 500
  produzido pelo tratador de erros. O tratador de erros envolve a validação e o método. A validação
  fica mais perto do método e responde 400 antes de qualquer caso de uso.
- **Erros de negócio não passam pelo decorator.** O controller recebe `Result` do caso de uso e
  chama `domainErrorResponse(result.error)` (`switch` exaustivo com `assertNever` em
  `interfaces/http/errors`). `@HandleHttpErrors` trata só o que é **lançado**, ou seja, falha
  inesperada (ADR-002): loga com `code` quando existir (inclusive um `DomainError` lançado por
  engano) e responde 500 genérico. Relançar o erro de negócio para o decorator mapear
  transformaria um fluxo tipado em exceção e perderia a exaustividade.

## Alternativas consideradas

- **middy (middleware por handler)**: é o padrão de mercado para Lambda, com `http-json-body-parser`,
  `http-error-handler` e validadores. Mas é dependência fora da stack, age no nível do handler
  (não do método do controller) e não atende ao diferencial "decorators" pedido. A composição
  funcional seria equivalente em poder; aqui a escolha segue o enunciado.
- **`HttpRequest<TBody>` no parâmetro do método** (sugestão original do plano): o método fica mais
  enxuto, mas o roteador passaria `HttpRequest<unknown>` para um parâmetro `HttpRequest<Body>`. Isso
  só compila com `as` ou declarando a tabela de rotas por uma interface com sintaxe de método, cujos
  parâmetros o TS checa de forma bivariante. Nos dois casos o tipo declarado mentiria, e remover o
  decorator deixaria dado não validado chegar ao caso de uso sem erro de compilação. Descartada.
- **`experimentalDecorators`** (estilo NestJS/class-validator): permitiria metadados de parâmetro,
  mas é o modelo legado e é proibido pelas regras.
- **Validação explícita no método** (`const parsed = parse(schema, request); if (!parsed.ok) return …`):
  simples, mas repete o desvio 400 em cada método e não atende ao diferencial.
- **Parse duplo** (`of` revalidando em vez de `WeakMap`): elimina o estado do token, mas executa o
  schema duas vezes e deixa a relação decorator → método implícita.

## Consequências

- Os decorators precisam repassar **o mesmo objeto** `HttpRequest` ao método (a chave do
  `WeakMap`). Nenhum decorator cria cópia da requisição.
- Métodos sem corpo (`listSchedules`) ainda declaram o parâmetro (`_request: HttpRequest`), porque
  o substituto tem um parâmetro obrigatório. O ESLint passa a ignorar argumentos com prefixo `_`.
- A ordem dos decorators é protegida por testes de integração: 400 e 500 também geram a linha
  `info` do `@LogRequest`. Inverter a ordem quebra esses testes.
- O `logger` do controller fica público (`readonly`), exigência estrutural de `WithLogger`.
- O `Content-Type` da requisição **não** é verificado (D24): o corpo é sempre lido como JSON.
  `curl -d` sem `-H` envia `application/x-www-form-urlencoded`, e exigir o header recusaria um
  payload válido. O 400 fica restrito a body ausente, JSON malformado e falha de validação.
