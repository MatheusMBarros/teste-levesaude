# ADR-009: `POST /triagem` na função `schedule`

Status: aceito (substitui parcialmente a ADR-008, que previa função própria para a triagem)

## Contexto

A ADR-008 juntou `GET /agendas` e `POST /agendamento` numa função `schedule` porque os dados vivem
só em memória (D7) e Lambdas distintas não compartilham memória. Ela previa `POST /triagem` em função
separada, "sem estado mutável compartilhado".

A premissa não se sustenta: `medicos_disponiveis` (contrato 3) cruza a sugestão com a agenda, e
`proximo_horario` precisa ser um horário **ainda livre**. Numa função separada, a triagem leria o
seed intacto do próprio container e sugeriria horários já reservados por `POST /agendamento`, que o
paciente não conseguiria agendar (409). O mesmo raciocínio da ADR-008 vale para a triagem.

## Decisão

- `POST /triagem` é o terceiro evento `http` da função `schedule`, com a linha
  `'POST /triagem'` na tabela do roteador (`schedule-handler.factory.ts`, ADR-008) e um
  `TriageController` próprio.
  O `SuggestSpecialtyUseCase` recebe o **mesmo** `InMemoryScheduleRepository` do agendamento.
- Timeout da função: **20 s** (`docs/regras/api.md`), exigido pela triagem. O adapter do LLM tem
  orçamento de 17 s no pior caso (ADR-010), com folga para a Lambda responder.
- O nome da função continua `schedule`: renomear não muda o comportamento e quebraria referências
  (logs, ADRs, `serverless.yml`).
- `TRIAGE_PROVIDER`, `TRIAGE_MODEL` e `ANTHROPIC_API_KEY` ficam em `provider.environment`.
  `ANTHROPIC_API_KEY: ${env:ANTHROPIC_API_KEY, ''}`: sem a variável no ambiente, o valor é `''`, que
  `loadTriageConfig` trata como ausente (triagem responde 503, D17). Verificado com
  `serverless package` sem a variável e `configValidationMode: error`: empacota sem erro e o template
  sai com `ANTHROPIC_API_KEY: ""`.
- **Configuração inválida × chave ausente no boot.** Um `TRIAGE_PROVIDER` desconhecido lança
  `InvalidConfigError` em `loadTriageConfig` e **derruba a função inteira no init** (as três rotas
  falham): fail-fast deliberado, porque é erro de deploy e deve aparecer no primeiro teste, não
  ficar escondido numa rota. A chave ausente é diferente: a função sobe, o boot registra um `warn` e
  só `/triagem` responde 503 (D17); agenda e agendamento seguem funcionando.
- **Provider `fake` avisa no boot.** Com `TRIAGE_PROVIDER=fake`, `createTriageModel` registra um
  `warn` (só `provider`, nada sensível) dizendo que `/triagem` responde por palavras-chave, sem LLM.
  Sem isso, um deploy com `fake` seria silencioso: 200 com sugestões de mentira.
- **O deploy exige `TRIAGE_PROVIDER=anthropic` explícito** no ambiente de quem roda
  `serverless deploy`. O `.env.example` usa `fake` só para a execução local sem chave
  (`cp .env.example .env && npm run dev`); como o `serverless.yml` tem `useDotenv: true`, um `.env`
  copiado dele levaria o `fake` para a AWS. O README (Fase 7) dirá isso no guia de deploy.

## Alternativas consideradas

- **Função `triage` separada** (plano original da ADR-008): agenda divergente entre funções, como
  explicado acima. Descartada enquanto o estado for só em memória.
- **Triagem sem `medicos_disponiveis` de verdade** (ler só o seed): contraria o contrato 3, que
  pede o cruzamento com a agenda.

## Consequências

- **A chave da Anthropic fica visível para a função inteira**, inclusive para as rotas que não a
  usam. Numa função só de triagem, o raio de exposição seria menor.
- **`GET /agendas` e `POST /agendamento` herdam o teto de 20 s.** Um bug que trave essas rotas
  custa mais tempo faturado antes do timeout. Aceito: elas não fazem I/O.
- As três rotas escalam juntas (mesma concorrência e memória), como já previa a ADR-008.
- Sem chave, a função sobe normalmente: o boot registra um `warn` e só `/triagem` responde 503.
  Já um `TRIAGE_PROVIDER` inválido derruba as três rotas no init (fail-fast, ver Decisão).
- **Em produção:** uma função por endpoint, agenda num banco compartilhado (DynamoDB com
  `ConditionExpression` na reserva, D14) e a chave lida do SSM Parameter Store ou do Secrets Manager
  (com permissão só na função de triagem), não de variável de ambiente em texto.
