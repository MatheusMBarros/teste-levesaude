# ADR-010: Triagem com LLM: porta, erros tipados, retentativas e orçamento de tempo

Status: aceito

## Contexto

`POST /triagem` (contrato 3) depende de um serviço externo lento, com cota e sem saída garantida.
Os requisitos pedem separação entre regra de negócio e chamada ao modelo, falhas como erros tipados
(503 sem chave ou com provedor indisponível, 502 para resposta inválida após retentativa, 504 para
timeout) e testes sem rede. A função tem 20 s de timeout (ADR-009).

## Decisão

### Porta e camadas

- Porta `TriageModel` (`src/application/ports/triage-model.port.ts`):
  `classify({ symptoms, allowedSpecialties }) → Promise<Result<TriageClassification, TriageError>>`.
  `allowedSpecialties` é uma tupla não vazia de `Specialty`. `TriageClassification.specialty` é
  `Specialty` tipado, e a porta promete mais que o tipo: a especialidade pertence a
  `allowedSpecialties` **desta requisição**. As implementações honram isso de verdade: o
  `AnthropicTriageModel` valida a saída com `triageOutputSchema(request.allowedSpecialties)` (Zod
  montado por requisição, `z.enum(allowed)` + `.strict()`), e o `FakeTriageModel` devolve
  `TriageInvalidResponseError` quando a regra escolhida aponta para fora da lista, sem fallback
  silencioso.
- `SuggestSpecialtyUseCase` tem a regra de negócio: lista fechada `SPECIALTIES`, leitura da agenda
  **depois** do modelo, médicos com horário livre e o mais cedo deles (D26), prefixo de emergência
  (D25) e o aviso fixo. Não conhece SDK, prompt nem HTTP, e não recebe `Logger`.
- `TRIAGE_DISCLAIMER` e `EMERGENCY_GUIDANCE` são constantes do caso de uso, não do prompt nem do
  presenter: são regra de negócio (D25). O texto de segurança sai igual qualquer que seja o provedor
  (Anthropic, fake ou um futuro), e não depende de o modelo lembrar de escrevê-lo. Por isso o prompt
  pede que a justificativa de emergência cite só o achado clínico, sem repetir a orientação de 192
  (ADR-011).
- **Sem fallback "Clínico Geral" no caso de uso.** A garantia de lista fechada vem do `enum` no
  `input_schema` da ferramenta e do Zod estrito (`triageOutputSchema`) no adapter. Especialidade fora
  da lista é **saída inválida** (retentativa, depois 502), não um valor a ser corrigido em silêncio.
  "Clínico Geral para casos vagos" é regra do prompt (ADR-011).
- Implementações: `AnthropicTriageModel` (SDK), `FakeTriageModel` (palavras-chave, determinístico,
  `TRIAGE_PROVIDER=fake`) e `UnavailableTriageModel` (provider `anthropic` sem chave: sempre
  `missing_api_key`). `createTriageModel` (`src/main/triage-model.factory.ts`) escolhe a
  implementação. O caso de uso não muda quando entra um provedor novo (O do SOLID).

### Erros tipados (`src/application/errors/`)

Estendem `DomainError`, voltam no `Result` e são mapeados no `switch` exaustivo da camada HTTP.

| Erro                         | `code`                    | HTTP | Dado extra (só para log)                                               |
| ---------------------------- | ------------------------- | ---- | ---------------------------------------------------------------------- |
| `TriageUnavailableError`     | `TRIAGE_UNAVAILABLE`      | 503  | `reason`: `missing_api_key`/`provider_unavailable`/`provider_rejected` |
| `TriageTimeoutError`         | `TRIAGE_TIMEOUT`          | 504  | `timeoutMs`                                                            |
| `TriageInvalidResponseError` | `TRIAGE_INVALID_RESPONSE` | 502  | `invalidOutputs` (quantas respostas do modelo foram rejeitadas)        |

Ficam em `application/errors` (e não em `domain/errors`) porque descrevem falha de uma dependência
da aplicação, não uma regra do domínio de agenda. O cliente recebe o mesmo 503 para os três
`reason`: detalhe do provedor nunca vai para a resposta.

**Por que estendem `DomainError`** mesmo sem serem do domínio: `DomainError` é, neste projeto, a
base de toda falha **esperada** que volta no `Result` e vira status HTTP pelo `code` literal
(ADR-002). Estendê-la dá aos erros da triagem o mesmo caminho dos erros de agenda: união
discriminada por `code`, `switch` exaustivo no mapeador (um `code` novo sem status quebra o
`typecheck`) e log do `code` no `@HandleHttpErrors`. Uma segunda hierarquia (`ApplicationError`)
duplicaria esse caminho sem ganho de comportamento; o nome da base é o único custo, e fica
registrado aqui.

### Classificação das falhas do SDK

Por `instanceof` nas classes exportadas por `@anthropic-ai/sdk`, do mais específico ao mais geral
(`APIConnectionTimeoutError` estende `APIConnectionError`):

| Falha                                                                                       | Ação                                                    | Resultado final                           |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| `APIConnectionTimeoutError`                                                                 | não retenta                                             | 504                                       |
| `RateLimitError` (429), `InternalServerError` (5xx, inclusive 529), `APIConnectionError`    | retenta com backoff                                     | esgotou: 503 `provider_unavailable`       |
| `retry-after`/`retry-after-ms` maior que `MAX_RETRY_AFTER_MS`                               | não retenta                                             | 503 `provider_unavailable`                |
| outro `APIError` (400, 401, 403, 404, 422...)                                               | não retenta                                             | 503 `provider_rejected`                   |
| `stop_reason: refusal`                                                                      | não retenta                                             | 502                                       |
| saída inválida (sem `tool_use` de `submit_triage`, `stop_reason: max_tokens`, falha no Zod) | `MAX_INVALID_OUTPUT_RETRIES` (1) retentativa, sem pausa | 502 se a retentativa também vier inválida |
| erro que não vem do SDK                                                                     | relança                                                 | 500 (`@HandleHttpErrors`)                 |

A recusa (`refusal`) é saída inválida, mas não é retentada: com o mesmo relato e o mesmo prompt,
uma recusa tende a se repetir, e a segunda chamada só gastaria tempo e cota antes do mesmo 502.

Nenhum caminho passa de `MAX_ATTEMPTS` chamadas no total, somando os dois tipos de retentativa.

### Precedência em falhas mistas

Quando uma triagem mistura falhas do provedor e saídas inválidas, vale, nesta ordem:

1. **Timeout em qualquer tentativa → 504 na hora**, sem olhar o que veio antes.
2. **502 só quando a saída inválida já foi retentada**, ou seja, quando houve
   `1 + MAX_INVALID_OUTPUT_RETRIES` (2) saídas inválidas na mesma triagem (ou uma recusa).
3. **Orçamento de tentativas esgotado por qualquer outro motivo → 503 `provider_unavailable`**,
   inclusive quando a última tentativa foi uma saída inválida que ainda tinha direito a retentativa:
   quem consumiu o limite foram as falhas do provedor, e o 502 diria que o modelo errou duas vezes,
   o que não aconteceu.

| Roteiro (`MAX_ATTEMPTS = 3`) | Resultado                  |
| ---------------------------- | -------------------------- |
| [429, 429, inválida]         | 503 `provider_unavailable` |
| [inválida, 429, 429]         | 503 `provider_unavailable` |
| [inválida, 429, inválida]    | 502 (`invalidOutputs: 2`)  |
| [inválida, inválida]         | 502 (`invalidOutputs: 2`)  |
| [429, inválida, inválida]    | 502 (`invalidOutputs: 2`)  |

Cada roteiro tem teste no `anthropic-triage.model.spec.ts`. `TriageInvalidResponseError.invalidOutputs`
conta só as saídas inválidas, nunca as falhas do provedor.
O timeout não é retentado porque uma segunda tentativa de 5 s dificilmente responde quando a
primeira não respondeu, e consumiria o orçamento que a Lambda precisa para devolver o 504.
Erros 4xx indicam problema de configuração (chave, modelo, parâmetro): repetir não resolve.

### Retentativa própria, SDK com `maxRetries: 0`

O cliente é criado com `maxRetries: 0`, `timeout: ATTEMPT_TIMEOUT_MS` e `logLevel: 'off'`, e cada
chamada repete `{ timeout: ATTEMPT_TIMEOUT_MS, maxRetries: 0 }`. Motivos:

- o SDK retenta timeouts 2 vezes por padrão: o 504 só viria depois de 3 × timeout;
- o SDK obedece `retry-after` sem teto e poderia estourar os 20 s da Lambda (a Lambda morreria sem
  resposta, e o gateway devolveria um 502/504 fora do formato de erro D9);
- a retentativa por saída inválida tem de ser nossa (o SDK não valida o conteúdo);
- empilhar as duas políticas daria até 6 tentativas e tornaria o orçamento imprevisível.

### Orçamento de tempo

Constantes exportadas por `anthropic-triage.model.ts`:

| Constante                    | Valor        |
| ---------------------------- | ------------ |
| `ATTEMPT_TIMEOUT_MS`         | 5 000        |
| `MAX_ATTEMPTS`               | 3            |
| `BACKOFF_MS`                 | [500, 1 000] |
| `MAX_RETRY_AFTER_MS`         | 1 000        |
| `MAX_INVALID_OUTPUT_RETRIES` | 1            |

A pausa antes da tentativa `n + 1` é `max(BACKOFF_MS[n - 1] × jitter, retry-after)`, com
`jitter = 0,75 + 0,25 × random()` (no máximo ×1). `retry-after-ms` (milissegundos) tem precedência
sobre `retry-after` (segundos ou data HTTP; data no passado conta como 0 e vale o backoff). Um
`retry-after` acima de `MAX_RETRY_AFTER_MS` encerra na hora com 503, então cada pausa fica limitada
a `max(BACKOFF_MS[i], MAX_RETRY_AFTER_MS)`. Pior caso, em função das constantes:

```
MAX_ATTEMPTS × ATTEMPT_TIMEOUT_MS + Σ_{i < MAX_ATTEMPTS − 1} max(BACKOFF_MS[i], MAX_RETRY_AFTER_MS)
  ≤ 20 000 ms (timeout da Lambda) − 3 000 ms (margem)

hoje: 3 × 5 s + max(0,5 s; 1 s) + max(1 s; 1 s) = 17 s
```

O pior caso atual é **17 s**, e sobram 3 s de margem. A margem cobre também a leitura do corpo da
resposta: o `timeout` do SDK é armado só em volta do `fetch` e limpo quando chegam os headers
(`fetchWithTimeout` em `@anthropic-ai/sdk`), então o download do corpo não conta nos 5 s por
tentativa. Com `max_tokens: 400`, o corpo é pequeno e já chega junto; a margem absorve o resto, além
do init da Lambda e da serialização da resposta.

Dois testes guardam o teto:

- **fórmula**: `MAX_ATTEMPTS × ATTEMPT_TIMEOUT_MS + Σ max(BACKOFF_MS[i], MAX_RETRY_AFTER_MS)
≤ 17 000`;
- **comportamento**: todas as tentativas com 5xx e `retry-after-ms = MAX_RETRY_AFTER_MS`,
  `random = () => 1`; a soma das pausas pedidas ao relógio falso mais
  `MAX_ATTEMPTS × ATTEMPT_TIMEOUT_MS` tem de ficar em até 17 000 ms. Se alguém subir
  `MAX_RETRY_AFTER_MS` (ex.: 3 000), os dois testes falham.

**Os valores são provisórios**: serão ajustados depois de medir a latência real do modelo (p99);
a conta acima vale para quaisquer valores das constantes.

### Ferramenta com `strict: false`

A ferramenta `submit_triage` declara `strict: false` explicitamente (com comentário apontando para
esta ADR), para a escolha ficar visível no código e testada. Na primeira requisição com um schema novo, a
API compila a gramática, o que pode custar segundos e dar 504 justamente na primeira chamada do
avaliador (e a cada mudança da lista de especialidades, que entra no `enum`). O `enum`, o
`tool_choice` forçado, o Zod estrito e a retentativa por saída inválida cobrem o risco de formato.

### Logs

Cada tentativa registra `provider`, `model`, `promptVersion` (`triage-v1`), `attempt`, `latencyMs`,
`errorKind`, `status`, `errorType`, `stopReason`, tokens de entrada e saída e `anthropicRequestId`.
O fim da triagem registra `attempts` (chamadas feitas) e, em falha, `code` e `reason`. **Nunca** vão para o log: os
sintomas, a chave, o objeto de erro do SDK (a mensagem pode ecoar dados da requisição) nem os valores
da saída do modelo. Em falha do Zod, só `path` e `code` de cada issue. O SDK fica com
`logLevel: 'off'` para não registrar nada por conta própria.

## Alternativas consideradas

- **Retentativa do SDK** (`maxRetries: 2`): mais simples, mas sem teto de `retry-after`, com
  retentativa de timeout e sem retentativa por saída inválida. Descartada pelos motivos acima.
- **Fallback "Clínico Geral" no caso de uso** para especialidade desconhecida: esconderia saída
  inválida do modelo como se fosse sugestão legítima. Descartada: o erro fica explícito (502).
- **Structured outputs** (`output_config.format`) em vez de tool use: mesma garantia de formato com
  o mesmo custo de compilação de gramática na primeira chamada. A ferramenta forçada funciona em
  todos os modelos que aceitam `tool_choice` forçado (ver ADR-011).
- **Streaming**: reduziria o tempo até o primeiro token, mas a resposta é curta (`max_tokens: 400`)
  e o cliente HTTP só recebe o JSON completo. Não compensa a complexidade.

## Consequências

- O caso de uso é testado com um stub da porta; o adapter, com um stub tipado do cliente
  (`AnthropicMessagesClient`) e erros **reais** do SDK, sem `jest.mock` nem rede.
- A interface estreita `AnthropicMessagesClient` precisa continuar compatível com o SDK: a atribuição
  `new Anthropic(...)` em `createTriageModel` é verificada pelo `typecheck` a cada atualização.
- Numa saída inválida persistente, o paciente espera duas chamadas antes do 502; numa recusa, uma.
- Se o modelo configurado tiver pensamento ativo por padrão, parte dos 400 tokens pode ir para ele e
  a resposta parar em `max_tokens` (saída inválida). A medição real dirá se é preciso aumentar
  `max_tokens`.
