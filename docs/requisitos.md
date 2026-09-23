# Requisitos destilados

## Obrigatórios

- Node.js >= 20, TypeScript em todo o projeto, tipagem explícita, **sem `any`**
- Serverless Framework + serverless-offline; funções AWS Lambda via **API Gateway REST**
- Dados mockados (sem banco); controle de conflito em memória
- Validação de payload: 400 (payload inválido), 409 (conflito de horário)
- Testes unitários da lógica de negócio com Jest
- ESLint + Prettier configurados
- README com execução local e deploy; repositório Git público

## Princípios avaliados

- Handlers finos; lógica de negócio fora do handler (casos de uso/serviços)
- Inversão de dependência: dependências concretas injetadas (testável sem mocks globais)
- SOLID consciente
- Erros de negócio como fluxo explícito, com classes de erro tipadas (não exceções genéricas)

## Diferenciais (vamos fazer todos)

- Testes de integração e e2e
- Decorators para validação, logging e tratamento de erros HTTP
- `POST /triagem` com LLM (qualidade do prompt, tratamento de falhas, separação negócio × chamada ao modelo)

---

## Contrato 1 — `GET /agendas` → 200

```json
{
  "medicos": [
    {
      "id": 1,
      "nome": "Dr. João Silva",
      "especialidade": "Cardiologista",
      "horarios_disponiveis": ["2026-06-10 09:00", "2026-06-10 10:00", "2026-06-10 11:00"]
    },
    {
      "id": 2,
      "nome": "Dra. Maria Souza",
      "especialidade": "Dermatologista",
      "horarios_disponiveis": ["2026-06-11 14:00", "2026-06-11 15:00"]
    }
  ]
}
```

## Contrato 2 — `POST /agendamento`

Payload:

```json
{
  "agendamento": {
    "medico_id": 1,
    "paciente": "Carlos Almeida",
    "data_horario": "2026-06-10 09:00"
  }
}
```

201:

```json
{
  "mensagem": "Agendamento realizado com sucesso",
  "agendamento": {
    "id": "uuid-gerado",
    "medico": "Dr. João Silva",
    "paciente": "Carlos Almeida",
    "data_horario": "2026-06-10 09:00"
  }
}
```

409 (texto EXATO):

```json
{
  "erro": "Horário indisponível",
  "mensagem": "O horário solicitado não está mais disponível para este médico."
}
```

## Contrato 3 (diferencial) — `POST /triagem`

Payload: `{ "sintomas": "texto livre" }` (string, trim, 10 a 2000 caracteres)

200:

```json
{
  "especialidade_sugerida": "Cardiologista",
  "urgencia": "media",
  "justificativa": "Dor no peito aos esforços e palpitações sugerem avaliação cardiológica.",
  "medicos_disponiveis": [
    { "id": 1, "nome": "Dr. João Silva", "proximo_horario": "2026-06-10 09:00" }
  ],
  "aviso": "Esta é uma sugestão automatizada e não substitui avaliação médica. Em caso de emergência, ligue 192."
}
```

- `urgencia`: `"baixa" | "media" | "alta" | "emergencia"`. Em `"emergencia"`, a resposta orienta procurar pronto-socorro/192.
- `especialidade_sugerida` restrita a uma lista fechada (as especialidades dos mocks + "Clínico Geral" como fallback).
- `medicos_disponiveis` cruza a sugestão com a agenda (regra de negócio no caso de uso, não no adapter do LLM).
- Falhas: sem API key/provedor indisponível → 503; resposta do modelo inválida após retentativa → 502; timeout → 504.

---

## Decisões sobre ambiguidades

| #   | Ambiguidade                                                        | Decisão                                                                                                                                                                                                                                                                                                                                    | Motivo                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Rotas `/agendas` (plural) e `/agendamento` (singular)              | Manter exatamente como no enunciado                                                                                                                                                                                                                                                                                                        | Contrato do avaliador; comentar no README que em API nova usaríamos `/agendamentos`                                                                                                               |
| D2  | Formato de data                                                    | `YYYY-MM-DD HH:mm`, sem timezone (horário local da clínica). Validar regex **e** data real (rejeitar `2026-02-30 10:00`)                                                                                                                                                                                                                   | Segue o enunciado                                                                                                                                                                                 |
| D3  | Datas no passado                                                   | **Não** rejeitar                                                                                                                                                                                                                                                                                                                           | Mocks são de jun/2026 (já no passado em relação à data de entrega); o avaliador testará com o payload do enunciado. Citar no README                                                               |
| D4  | Médico inexistente                                                 | 404 `{ erro: "Médico não encontrado", mensagem: "O médico informado não existe." }`                                                                                                                                                                                                                                                        | Recurso referenciado não existe                                                                                                                                                                   |
| D5  | Horário que nunca esteve na agenda do médico                       | 422 `{ erro: "Horário não ofertado", mensagem: "O horário solicitado não faz parte da agenda deste médico." }`                                                                                                                                                                                                                             | Diferente de "ocupado" (409). Registrar ADR; alternativa aceitável: 409                                                                                                                           |
| D6  | Após agendar                                                       | O horário some de `horarios_disponiveis` no `GET /agendas`                                                                                                                                                                                                                                                                                 | Consistência entre endpoints. Só é possível porque os dois endpoints vivem na mesma função Lambda (D15)                                                                                           |
| D7  | Persistência do estado em memória                                  | Vive por container Lambda / processo do serverless-offline; container de dependências criado no escopo do módulo                                                                                                                                                                                                                           | Documentar limitação no README (instâncias diferentes não compartilham estado)                                                                                                                    |
| D8  | Payload inválido                                                   | 400 `{ erro: "Payload inválido", mensagem, detalhes: [{ campo, problema }] }` — inclui JSON malformado e body ausente                                                                                                                                                                                                                      | Erro acionável pelo cliente                                                                                                                                                                       |
| D9  | Formato de erro                                                    | Sempre `{ erro, mensagem, detalhes? }`; 500 com mensagem genérica, sem stack trace                                                                                                                                                                                                                                                         | Consistência + segurança                                                                                                                                                                          |
| D10 | ID do agendamento                                                  | UUID v4 via `crypto.randomUUID()` atrás da porta `IdGenerator`                                                                                                                                                                                                                                                                             | Testável/determinístico em teste                                                                                                                                                                  |
| D11 | Nomenclatura                                                       | Contrato HTTP em snake_case; código interno camelCase; mapeamento nos presenters                                                                                                                                                                                                                                                           | Contrato ≠ modelo de domínio                                                                                                                                                                      |
| D12 | `paciente`                                                         | string, trim, 3–120 caracteres                                                                                                                                                                                                                                                                                                             | Evitar nomes vazios                                                                                                                                                                               |
| D13 | `medico_id`                                                        | inteiro positivo                                                                                                                                                                                                                                                                                                                           | Segue o enunciado                                                                                                                                                                                 |
| D14 | Corrida no mesmo horário                                           | Repositório expõe operação atômica `reserveSlot` (sem check-then-act no caso de uso)                                                                                                                                                                                                                                                       | Evita race condition mesmo em memória                                                                                                                                                             |
| D15 | Estado compartilhado entre `GET /agendas` e `POST /agendamento`    | **Uma única função Lambda `schedule`** com os dois eventos `http`; o handler despacha por tabela `resource + httpMethod` → controller (sem `if` de negócio). `POST /triagem` em função separada                                                                                                                                            | Lambdas distintas nunca compartilham memória (na AWS; no serverless-offline v13 o modo padrão _worker-threads_ isola cada handler; o serverless-esbuild gera um bundle por função). Registrar ADR |
| D16 | Idioma do código                                                   | Identificadores **em inglês** (classes, funções, variáveis, arquivos, env vars). Português no contrato HTTP (chaves snake_case do enunciado, mapeadas na camada HTTP), mensagens ao usuário, valores de domínio exibidos no contrato, descrições de testes, comentários e docs; exceções internas em inglês. Glossário abaixo; ver ADR-006 | Padrão internacional (`docs/regras/api.md`)                                                                                                                                                       |
| D17 | Triagem sem API key                                                | `TRIAGE_PROVIDER=anthropic\|fake` (padrão `anthropic`). Provider `anthropic` sem `ANTHROPIC_API_KEY` → 503. `fake` (determinístico) usado em testes/e2e e opt-in local                                                                                                                                                                     | Mantém o contrato de falha (503) e permite rodar sem chave de forma explícita                                                                                                                     |
| D18 | Runtime Node                                                       | `nodejs20.x` e `.nvmrc` 20. Verificado na Fase 1: o schema do Serverless v3.40 aceita no máximo `nodejs20.x` (preferência original era `nodejs22.x`). Ver ADR-001                                                                                                                                                                          | Node 20 em fim de vida (abr/2026), mas é o maior runtime aceito pela v3; o enunciado pede "v20 ou superior"                                                                                       |
| D19 | Erros gerados pelo API Gateway (rota inexistente, 403 etc.) e CORS | `GatewayResponses` DEFAULT_4XX/DEFAULT_5XX no formato `{ erro, mensagem }`; header `Access-Control-Allow-Origin` em **todas** as respostas da Lambda, inclusive erros                                                                                                                                                                      | `cors: true` não adiciona headers em respostas de proxy; formato de erro consistente (D9)                                                                                                         |
| D20 | Onde vive a regra 404/422/409                                      | 422/409 no agregado de domínio `DoctorSchedule.reserve` (puro); 404 no repositório (localizar o agregado). Ver ADR-004                                                                                                                                                                                                                     | Regra de negócio no domínio, testável sem infraestrutura                                                                                                                                          |
| D21 | Médico sem horários livres no `GET /agendas`                       | Continua na lista com `horarios_disponiveis: []`                                                                                                                                                                                                                                                                                           | O médico existe; só não tem agenda livre                                                                                                                                                          |
| D22 | `data_horario` com espaços nas pontas                              | Rejeitar com 400 (sem trim)                                                                                                                                                                                                                                                                                                                | Formato estrito (D2)                                                                                                                                                                              |
| D23 | Ordem de médicos e horários                                        | Ordem do seed, sem ordenação                                                                                                                                                                                                                                                                                                               | Previsível e igual ao enunciado                                                                                                                                                                   |
| D24 | `Content-Type` da requisição                                       | **Não exigir.** O corpo é sempre interpretado como JSON, qualquer que seja o header. 400 só para body ausente, JSON malformado ou falha de validação                                                                                                                                                                                       | `curl -d` sem `-H` envia `application/x-www-form-urlencoded`; exigir o header daria 400 num payload válido do avaliador. Ver ADR-007                                                              |

## Glossário (D16)

| Domínio (PT)                         | Código (EN)                                                                                                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Médico / agenda / horário disponível | `Doctor` / `Schedule` / `availableSlots`                                                                                            |
| Agendamento                          | `Appointment`                                                                                                                       |
| Data-horário (`YYYY-MM-DD HH:mm`)    | `SlotDateTime` (value object)                                                                                                       |
| `reservarHorario`                    | `reserveSlot`                                                                                                                       |
| Portas                               | `ScheduleRepository`, `AppointmentRepository`, `IdGenerator`, `Logger`, `TriageModel`                                               |
| Casos de uso                         | `ListSchedulesUseCase`, `CreateAppointmentUseCase`, `SuggestSpecialtyUseCase`                                                       |
| Erros de domínio (`code`)            | `DoctorNotFoundError` (`DOCTOR_NOT_FOUND`), `SlotNotOfferedError` (`SLOT_NOT_OFFERED`), `SlotUnavailableError` (`SLOT_UNAVAILABLE`) |
| Erros da triagem                     | `TriageUnavailableError` (503), `TriageInvalidResponseError` (502), `TriageTimeoutError` (504)                                      |
| Triagem (adapters)                   | `AnthropicTriageModel`, `FakeTriageModel`, `triage.prompt.v1.ts`                                                                    |
| Env vars                             | `TRIAGE_PROVIDER`, `TRIAGE_MODEL`, `ANTHROPIC_API_KEY`                                                                              |

## Dados mock

Manter os médicos 1 e 2 **idênticos** ao enunciado e adicionar mais 3 (Pediatra, Ortopedista, Clínico Geral),
com horários em 2026-06, para a triagem ter para onde apontar.
