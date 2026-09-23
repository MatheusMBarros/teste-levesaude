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

- [ ] `Result<T, E>` + `assertNever` (a Fase 1 já criou `ok`/`err` como smoke test do pipeline)
- [ ] Trocar `npm test` por `npm run test:coverage` no script `check` (thresholds de 90% passam a valer — ADR-001)
- [ ] Erros de domínio tipados (`DomainError` abstrato com `code` literal)
- [ ] Entidades/value objects: `Doctor`, `Appointment`, `SlotDateTime`
- [ ] Portas: `ScheduleRepository`, `AppointmentRepository`, `IdGenerator`, `Logger`
- [ ] `ListSchedulesUseCase` + testes
- [ ] `CreateAppointmentUseCase` + testes (sucesso, 404, 422, 409, horário some da agenda)

## Fase 3 — Infraestrutura

- [ ] Seed mock (médicos 1 e 2 idênticos ao enunciado + 3 extras)
- [ ] `InMemoryScheduleRepository` com `reserveSlot` atômico + testes
- [ ] `InMemoryAppointmentRepository`, `CryptoIdGenerator`, `JsonLogger`

## Fase 4 — Camada HTTP + Serverless

- [ ] Schemas Zod (tipos via `z.infer`) com mensagens em PT
- [ ] Decorators: `@ValidateBody`, `@HandleHttpErrors`, `@LogRequest` (desenho tipado sem `as`: decorator padrão não muda a assinatura do método — ex. `HttpRequest<TBody>`)
- [ ] Mapeamento `DomainError → HttpResponse` exaustivo
- [ ] Presenters snake_case
- [ ] Controllers + handlers finos + composition root (`src/main/container.ts`)
- [ ] Funções no `serverless.yml`: `schedule` (GET /agendas + POST /agendamento, roteamento por tabela — D15) e `triage`; `GatewayResponses` 4XX/5XX e CORS em todas as respostas (D19)
- [ ] `serverless package` gera o artefato sem erro (prova do deploy, sem executá-lo)
- [ ] Testes de integração dos handlers (evento API Gateway fabricado)

## Fase 5 — Triagem com IA (diferencial)

- [ ] Porta `TriageModel` + `SuggestSpecialtyUseCase` (cruza com agenda)
- [ ] Prompt versionado (`triage.prompt.v1.ts`) com saída estruturada (tool use forçado)
- [ ] `AnthropicTriageModel` com timeout, retentativa, validação Zod da saída
- [ ] `FakeTriageModel` (determinístico), ativado por `TRIAGE_PROVIDER=fake` (D17)
- [ ] Erros tipados: 502/503/504
- [ ] Testes unit + integração

## Fase 6 — E2E

- [ ] E2E com serverless-offline subindo em `globalSetup` e `fetch` nativo

## Fase 7 — Documentação e entrega

- [ ] README completo
- [ ] ADRs revisados
- [ ] `requests.http` ou coleção de exemplos cURL
- [ ] Revisão final como avaliador
