# Plano de execução

Marque `[x]` apenas com `npm run check` verde. Uma fase por vez.

## Fase 1 — Setup do projeto

- [x] `package.json` (engines node >= 20), scripts listados no CLAUDE.md
- [x] Versões fixadas: `typescript@5.9.3` (TS 7 é incompatível com typescript-eslint e ts-jest), `serverless@3.40.0`, `serverless-offline@13.10.1`
- [x] `tsconfig.json` strict (+ `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`)
- [x] ESLint flat config (`typescript-eslint` strictTypeChecked, `no-explicit-any: error`, `explicit-module-boundary-types`) + `eslint-config-prettier`
- [x] Prettier + `.prettierignore`
- [x] Jest com ts-jest, projetos `unit` / `integration` / `e2e`; thresholds de 90% em `domain` e `application` configurados (passam a ser exigidos no `check` na Fase 2 — ADR-001)
- [x] `serverless.yml` (v3, `nodejs20.x` — v3.40 não aceita `nodejs22.x` (D18) —, sa-east-1, serverless-esbuild, serverless-offline com `noPrependStageInUrl`)
- [x] `.gitignore`, `.nvmrc`, `.env.example`, `.editorconfig`
- [x] Verificar compatibilidade de versões (serverless v3 × offline v13 × esbuild) e registrar em ADR-001

## Fase 2 — Domínio e aplicação (TDD)

- [x] `Result<T, E>` + `assertNever` (a Fase 1 já criou `ok`/`err` como smoke test do pipeline)
- [x] Trocar `npm test` por `npm run test:coverage` no script `check` (thresholds de 90% passam a valer — ADR-001)
- [x] Erros de domínio tipados (`DomainError` abstrato com `code` literal)
- [x] Entidades/value objects: `Doctor`, `Appointment`, `SlotDateTime` + agregado `DoctorSchedule` (regra 422/409, D20)
- [x] Portas: `ScheduleRepository`, `AppointmentRepository`, `IdGenerator`, `Logger`
- [x] `ListSchedulesUseCase` + testes
- [x] `CreateAppointmentUseCase` + testes (sucesso, 404, 422, 409, horário some da agenda)

## Fase 3 — Infraestrutura

- [x] Seed mock (médicos 1 e 2 idênticos ao enunciado + 3 extras)
- [x] `InMemoryScheduleRepository` com `reserveSlot` atômico + testes
- [x] `InMemoryAppointmentRepository`, `CryptoIdGenerator`, `JsonLogger`

## Fase 4 — Camada HTTP + Serverless

- [x] Schemas Zod (tipos via `z.infer`) com mensagens em PT
- [x] Decorators: `@ValidateBody`, `@HandleHttpErrors`, `@LogRequest` (desenho tipado sem `as`: decorator padrão não muda a assinatura do método, então o método recebe o `HttpRequest` bruto e lê o corpo validado com `ValidatedBody.of(request)` — ADR-007)
- [x] Mapeamento `DomainError → HttpResponse` exaustivo
- [x] Presenters snake_case
- [x] Controllers + handlers finos + composition root (`src/main/container.ts`)
- [x] Log de erros inclui o `code` dos `DomainError` (o `JsonLogger` hoje serializa só `name`, `message` e `stack`)
- [x] Logger de produção usa um `stdoutWriter` exportado de `src/infrastructure/logger` (acrescenta a quebra de linha), com teste; o container não recebe `process.stdout.write` diretamente (ADR-005)
- [x] Funções no `serverless.yml`: `schedule` (GET /agendas + POST /agendamento, roteamento por tabela — D15; `triage` entra na Fase 5 (revisto pela ADR-009: /triagem entra na função schedule)); `GatewayResponses` 4XX/5XX e CORS em todas as respostas (D19)
- [x] `serverless package` gera o artefato sem erro (prova do deploy, sem executá-lo)
- [x] Testes de integração dos handlers (evento API Gateway fabricado)

## Fase 5 — Triagem com IA (diferencial)

- [x] Porta `TriageModel` + `SuggestSpecialtyUseCase` (cruza com agenda)
- [x] Prompt versionado (`triage.prompt.v1.ts`) com saída estruturada (tool use forçado)
- [x] `AnthropicTriageModel` com timeout, retentativa, validação Zod da saída
- [x] `FakeTriageModel` (determinístico), ativado por `TRIAGE_PROVIDER=fake` (D17)
- [x] Erros tipados: 502/503/504
- [x] Testes unit + integração
- [x] `POST /triagem` na tabela da função `schedule` + `timeout: 20` (ADR-009)
- [x] Env vars no `serverless.yml`/`.env.example` + validação Zod no composition root; `serverless package` sem `ANTHROPIC_API_KEY`
- [ ] Validação real com a API (latência medida; constantes de timeout/tentativas ajustadas — ADR-010)
- [ ] Multi-provedor (Anthropic/OpenAI/Google via Vercel AI SDK): trabalho em progresso no branch
      `feat/multi-provider` (WIP, fora de `main`); retomar antes da entrega ou deixar registrado
      como próximo passo

## Fase 6 — E2E

- [ ] E2E com serverless-offline subindo em `globalSetup` e `fetch` nativo (próximo passo; ainda
      não iniciado em `main`)

## Fase 7 — Documentação e entrega

- [ ] README completo
- [ ] README com a seção "Por que uma Lambda para duas rotas": restrição do estado em memória (D6, D7, D15, ADR-008) e a alternativa em produção (uma função por endpoint + DynamoDB com `ConditionExpression` para a reserva atômica)
- [ ] ADRs revisados
- [ ] `requests.http` ou coleção de exemplos cURL
- [x] `GatewayResponse` `MISSING_AUTHENTICATION_TOKEN` com 404 no formato `{ erro, mensagem }` e CORS (a AWS REST devolve 403 por padrão para rota inexistente; conferido no template do `serverless package`); limitação do serverless-offline registrada em D19
- [ ] Nota no README de que o serverless-offline ignora `GatewayResponses` e devolve o 404 dele, fora do formato do contrato (D19)
- [x] Arredondar `durationMs` no `@LogRequest`
- [ ] Comentar no `serverless.yml` por que `schedule` tem 20 s e o `provider.timeout` 6 s fica como padrão para funções futuras (as CRUD, quando cada endpoint tiver função própria — `docs/regras/api.md`)
- [ ] Teste de rota desconhecida conferir `method` e `resource` no log
- [ ] Revisão final como avaliador
