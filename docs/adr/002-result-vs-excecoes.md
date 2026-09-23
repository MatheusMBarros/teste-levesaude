# ADR-002: Erros de negócio como `Result`, não exceções

Status: aceito

## Contexto

O enunciado avalia "erros de negócio como fluxo explícito, com classes de erro tipadas". O
`POST /agendamento` tem três falhas de negócio esperadas (médico inexistente, horário não
ofertado, horário ocupado) que viram 404/422/409. Com exceções, a assinatura do caso de uso não
diz o que pode falhar, e nada obriga o chamador a tratar cada caso.

## Decisão

- Casos de uso com falha de negócio retornam `Promise<Result<T, E>>` (`src/shared/result.ts`), em
  que `E` é a **união fechada** dos erros possíveis (`CreateAppointmentError` =
  `DoctorNotFoundError | SlotNotOfferedError | SlotUnavailableError`). Eles não lançam para erro
  de negócio.
- `throw` / Promise rejeitada fica para falha inesperada (bug, infra), e vira 500 no decorator de
  erros HTTP (Fase 4).
- Casos de uso **sem** falha de negócio (`ListSchedulesUseCase`) retornam o valor direto: um
  `Result<T, never>` seria cerimônia sem informação.
- Todos os erros de negócio estendem `DomainError` (abstrato) com `readonly code` literal
  (`'DOCTOR_NOT_FOUND'`, `'SLOT_NOT_OFFERED'`, `'SLOT_UNAVAILABLE'`, `'INVALID_SLOT_DATE_TIME'`).
  O `code` é o discriminante: o mapeamento HTTP da Fase 4 faz `switch (error.code)` exaustivo
  com `assertNever`, e um erro novo na união quebra a compilação até ser mapeado.
- Os erros carregam **contexto** (`doctorId`; `slot` quando se aplica). Isso serve para log
  estruturado e para os testes verificarem que o erro se refere ao pedido certo. O domínio **não**
  carrega textos ao usuário (`erro`/`mensagem`): isso é apresentação e fica no mapeamento HTTP.
  O `message` herdado de `Error` é só diagnóstico técnico, em inglês, e nunca é exposto.
- `DomainError extends Error`: custo desprezível, e dá `name`/`stack` úteis se algum erro for
  lançado por engano.
- `InvalidSlotDateTimeError` também é `DomainError`: ele protege um invariante do domínio
  (`SlotDateTime` só existe válido), mesmo que no fluxo HTTP o texto seja convertido na borda e o
  erro vire 400 lá (ADR-004). Ele não entra na união de nenhum caso de uso.

## Alternativas consideradas

- **Exceções tipadas + `instanceof` no handler**: idiomático em JS, mas a assinatura esconde as
  falhas e o tratamento não é verificado pelo compilador. Descartada.
- **Biblioteca (`neverthrow`, `fp-ts`)**: API mais rica (`map`, `andThen`) que não é necessária
  aqui. Seria dependência fora da stack. Um tipo de 3 linhas basta.
- **Erro como união de literais (`'DOCTOR_NOT_FOUND' | ...`) sem classes**: mais leve, mas perde
  o contexto e contraria o "classes de erro tipadas" pedido.
- **Mensagem HTTP dentro do erro de domínio**: acopla o domínio ao contrato em português e à
  camada de apresentação. Descartada.

## Consequências

- O chamador precisa checar `result.ok` antes de acessar `value`. O compilador garante isso.
- Duas vias de erro coexistem (Result para negócio, throw para inesperado). A regra é simples e
  está documentada em `UseCase` e no port.
- Classes de erro são estruturalmente distintas pelo `code` literal. Isso é o que permite a união
  discriminada, apesar da tipagem estrutural do TypeScript.
