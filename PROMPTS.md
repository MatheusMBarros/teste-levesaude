# Roteiro de prompts — Claude Code

## Como usar

1. Crie a pasta do repo, copie este kit para dentro (`CLAUDE.md`, `.claude/`, `docs/`) e rode `git init`.
2. Abra `claude` na raiz do repo.
3. Siga os prompts em ordem. Use **Plan Mode** (Shift+Tab) nos prompts marcados com 🧭.
4. Rode `/clear` entre fases — o contexto necessário está no CLAUDE.md e em `docs/`, não no histórico.
5. Atalho: `/fase N` executa o fluxo padrão de uma fase. Os prompts abaixo são a versão detalhada, com orientações específicas de cada fase. Prefira-os.

---

## Prompt 0 — Entendimento e validação do plano 🧭

```
Leia CLAUDE.md, docs/requisitos.md, docs/plano.md, todos os arquivos em docs/regras/ e o PDF docs/teste-tecnico.pdf.
Use o subagente arquiteto para confrontar o PDF com docs/requisitos.md e o plano.

Não escreva código. Me devolva:
1. Resumo do entendimento em até 10 linhas.
2. Qualquer requisito do PDF que não esteja coberto em requisitos.md ou no plano.
3. Ambiguidades ainda sem decisão (com sua recomendação).
4. Riscos técnicos, especialmente compatibilidade Serverless v3 × serverless-offline v13 × serverless-esbuild × Node 20 e decorators TS 5 com esbuild e ts-jest.
```

## Prompt 1 — Fase 1: Setup

```
Execute a Fase 1 do docs/plano.md.

- Use o subagente arquiteto para definir versões exatas das dependências (verifique compatibilidade no npm antes de escolher), a config do serverless.yml e registrar ADR-001 (por que Serverless v3 em vez de v4: v4 exige login/licença, o que atrapalha o avaliador de rodar localmente).
- Depois implemente você mesmo o setup. Requisitos:
  - scripts do CLAUDE.md, incluindo "check"
  - tsconfig strict com as flags do plano; target ES2022
  - ESLint flat config com typescript-eslint strictTypeChecked, no-explicit-any como error, explicit-module-boundary-types, integração com Prettier
  - Jest com projects unit (src/**/*.spec.ts), integration (tests/integration) e e2e (tests/e2e), coverageThreshold 90% para src/domain e src/application
  - serverless.yml: provider aws, runtime nodejs22.x (confirmar suporte no v3.40; senão nodejs20.x — D18), region sa-east-1, stage via opção com default dev, plugins serverless-esbuild e serverless-offline (noPrependStageInUrl: true, httpPort 3000), useDotenv. Ainda sem funções.
  - .gitignore, .nvmrc (20), .editorconfig, .env.example
- Crie um src/shared/result.ts com um teste trivial só para provar que o pipeline roda.
- Valide: npm run check verde e npm run dev sobe sem erro.
- Commit: "chore(setup): configura typescript, lint, testes e serverless".
```

## Prompt 2 — Fase 2: Domínio e aplicação (TDD) 🧭

```
Execute a Fase 2 do docs/plano.md em TDD, com esta orquestração:

1. Subagente arquiteto: escreva os contratos — Result<T,E> e assertNever em shared; DomainError abstrato com code literal; DoctorNotFoundError, SlotNotOfferedError, SlotUnavailableError; value object SlotDateTime (formato YYYY-MM-DD HH:mm, rejeita datas inexistentes, construção via método estático que retorna Result); entidades Doctor e Appointment; portas ScheduleRepository (list, findById, reserveSlot atômico retornando Result), AppointmentRepository, IdGenerator, Logger; assinaturas de ListSchedulesUseCase e CreateAppointmentUseCase. Identificadores em inglês (glossário D16). Registre ADR sobre Result vs exceções e ADR sobre 422 vs 409 (decisão D5).
   Mostre os contratos e aguarde minha aprovação.
2. Subagente testador: testes unitários de SlotDateTime e dos dois casos de uso usando fakes das portas em tests/helpers/fakes e builders. Devem falhar.
3. Subagente dev-backend: implemente até ficar verde.
4. /checar, depois subagente revisor. Corrija bloqueadores.
5. Commits separados: contratos, testes+implementação de SlotDateTime, casos de uso.

Lembre: caso de uso não lança exceção para erro de negócio, e não existe check-then-act — a reserva é feita pela operação atômica do repositório.
```

## Prompt 3 — Fase 3: Infraestrutura

```
Execute a Fase 3 do docs/plano.md.

- Seed em src/infrastructure/mocks/medicos.seed.ts: médicos 1 e 2 idênticos ao enunciado (nome, especialidade, horários) + Pediatra, Ortopedista e Clínico Geral com horários em junho/2026.
- InMemoryScheduleRepository recebe o seed pelo construtor (não importa direto) e copia os dados (sem mutar o seed). reserveSlot remove o horário da lista de disponíveis e retorna erro tipado se não estiver disponível.
- InMemoryAppointmentRepository, CryptoIdGenerator (crypto.randomUUID), JsonLogger (JSON por linha, níveis info/warn/error).
- Subagente testador escreve os testes dos repositórios primeiro (incluindo: reservar duas vezes o mesmo horário → segunda falha; seed original não é mutado).
- Implemente, /checar, subagente revisor, commit.
```

## Prompt 4 — Fase 4: HTTP, decorators e Serverless 🧭

```
Execute a Fase 4 do docs/plano.md.

1. Subagente arquiteto: defina
   - HttpResponse<TBody> e helpers (ok, created, erro)
   - schemas Zod para POST /agendamento (mensagens em PT, paths como "agendamento.medico_id")
   - decorators TS 5 padrão (sem experimentalDecorators): @HandleHttpErrors (DomainError → status via switch exaustivo; desconhecido → 500 genérico e log), @ValidateBody(schema) (parse do JSON + Zod → 400 com detalhes; injeta body tipado), @LogRequest (método, rota, status, duração, requestId)
   - controllers como classes recebendo casos de uso no construtor
   - presenters para o contrato snake_case
   - src/main/container.ts como composition root no escopo do módulo
   - ADR sobre decorators vs middleware (ex. middy) e sobre o estado em memória por container
   Aguarde minha aprovação.
2. Subagente testador: testes de integração em tests/integration chamando os handlers exportados com eventos APIGatewayProxyEvent fabricados. Cubra: 200 do GET com corpo exato; 201; 400 (JSON malformado, body vazio, medico_id string, data 2026-02-30 10:00, paciente vazio); 404; 422; 409 com texto exato; fluxo agendar → GET sem o horário → reagendar → 409.
3. Subagente dev-backend: implemente. Handlers devem ter poucas linhas. Registre as funções no serverless.yml com eventos http (REST), cors: true, timeout 6.
4. Suba `npm run dev` e valide com curl os cenários principais. Cole os resultados.
5. /checar, subagente revisor, correções, commits.
```

## Prompt 5 — Fase 5: Triagem com IA 🧭

```
Execute a Fase 5 do docs/plano.md usando o subagente engenheiro-ia como responsável principal.

Pontos que serão avaliados e precisam estar evidentes no código:
- qualidade do prompt (versionado, papel claro, lista fechada de especialidades injetada, sintomas delimitados contra prompt injection, critérios de urgência, few-shot, saída estruturada via tool use forçado)
- tratamento de falhas da chamada externa (timeout, retentativa com backoff, saída inválida, ausência de chave) com erros tipados mapeados para 502/503/504
- separação entre regra de negócio (SuggestSpecialtyUseCase: especialidades permitidas, fallback Clínico Geral, cruzamento com agenda, aviso fixo) e chamada ao modelo (AnthropicTriageModel)

Fluxo: engenheiro-ia propõe contratos + prompt → eu aprovo → testador escreve testes (caso de uso com fake; adapter com cliente stub; integração do handler com FakeTriageModel) → engenheiro-ia implementa → /checar → revisor → commits.
Configure TRIAGE_PROVIDER (anthropic|fake), TRIAGE_MODEL e ANTHROPIC_API_KEY no .env.example e no serverless.yml (função com timeout 20).
Ao final, se eu tiver chave no .env, rode 4 sintomas reais via curl (cardíaco, pele, ambíguo, emergência) e mostre as respostas.
```

## Prompt 6 — Fase 6: E2E

```
Execute a Fase 6 do docs/plano.md.
Subagente testador: crie tests/e2e com globalSetup que sobe o serverless-offline em porta livre (TRIAGE_PROVIDER=fake), aguarda ficar pronto e derruba no globalTeardown. Use fetch nativo. Cubra o fluxo completo de agendamento e um caso da triagem. Script npm run test:e2e separado (não entra no check padrão se for lento — documente).
/checar, revisor, commit.
```

## Prompt 7 — Fase 7: Documentação

```
Execute a Fase 7 do docs/plano.md com o subagente documentador.
Ele deve verificar rodando cada comando que citar (exceto deploy). Inclua requests.http com todos os cenários.
Depois, peça ao subagente revisor que avalie apenas o critério Documentação seguindo o README do zero como se fosse o avaliador.
Commit: "docs: adiciona README, ADRs e exemplos de requisição".
```

## Prompt 8 — Revisão final como avaliador 🧭

```
Use o subagente revisor para uma revisão COMPLETA do repositório (não só o diff), simulando o avaliador técnico com o enunciado em docs/teste-tecnico.pdf.
Quero: checklist de cada requisito do PDF (atendido / parcial / não atendido com evidência arquivo:linha), notas por critério, top 5 melhorias de maior impacto e as perguntas mais difíceis da entrevista.
Depois, proponha um plano para os itens parcial/não atendido e aguarde minha aprovação.
```

## Prompt 9 — Preparação para a entrevista

```
Com base no código, nos ADRs e no README, monte um guia de defesa do projeto em docs/defesa.md (não commitar; adicione ao .gitignore):
- as 15 perguntas mais prováveis do avaliador com respostas curtas e diretas, citando arquivos
- onde cada princípio SOLID aparece no código
- trade-offs que eu aceitei e o que faria diferente em produção (DynamoDB com ConditionExpression, idempotency key, auth, observabilidade, rate limit na triagem)
```

---

## Prompts de correção de rota

**Contexto grande / agente perdido:**

```
Resuma em 10 linhas o estado atual da fase, o que falta e decisões tomadas; atualize docs/plano.md. Depois vou dar /clear.
```

**Apareceu `any`, cast ou gambiarra:**

```
Rode grep por any, "as ", @ts-ignore e eslint-disable em src e tests. Para cada ocorrência, explique por que existe e substitua por tipagem correta (unknown + narrowing, generics ou z.infer). Não use cast para silenciar o compilador.
```

**Handler engordou:**

```
O handler X tem lógica que não é dele. Mova validação para o decorator, regra para o caso de uso e formatação para o presenter. Mostre o antes/depois.
```

**Agente quer mudar contrato do enunciado:**

```
Pare. Os contratos de docs/requisitos.md são literais. Reverta a mudança de chave/mensagem/status e, se achar que há motivo, registre como sugestão no README em vez de alterar a API.
```
