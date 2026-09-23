# API de Agendamento Médico — Teste Técnico (Leve Saúde)

Teste técnico para vaga de Desenvolvedor Backend. O projeto será avaliado em: qualidade de código,
domínio de TypeScript, Serverless, design de API, arquitetura, testes e documentação.
**Toda decisão não óbvia precisa ser justificável** — registre-a em `docs/adr/`.

## Fontes da verdade

- Enunciado original: `docs/teste-tecnico.pdf`
- Requisitos destilados + decisões sobre ambiguidades: @docs/requisitos.md
- Plano de execução por fases (mantenha os checkboxes atualizados): @docs/plano.md

Se algo no código contradizer `docs/requisitos.md`, o requisito vence. Se o requisito estiver
ambíguo e não houver decisão registrada, PARE e pergunte antes de decidir.

## Regras obrigatórias

@docs/regras/typescript.md
@docs/regras/arquitetura.md
@docs/regras/api.md
@docs/regras/testes.md
@docs/regras/git.md

## Stack

Node.js >= 20.19 (runtime `nodejs20.x`, ver D18 / ADR-001) · TypeScript 5.9 strict · Serverless Framework v3 + serverless-esbuild + serverless-offline v13 ·
AWS Lambda + API Gateway **REST** (eventos `http`, não `httpApi`) · Zod · Jest (ts-jest) ·
ESLint (typescript-eslint, flat config) + Prettier · @anthropic-ai/sdk (triagem)

## Comandos

- `npm run dev` — serverless offline em http://localhost:3000 (sem prefixo de stage)
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` / `npm run lint:fix`
- `npm run format` / `npm run format:check`
- `npm test` · `npm run test:unit` · `npm run test:integration` · `npm run test:e2e` · `npm run test:coverage`
- `npm run check` — typecheck + lint + format:check + testes. **Rodar antes de todo commit.**

## Subagentes (`.claude/agents/`)

| Agente          | Papel                                                                               | Escreve código de produção? |
| --------------- | ----------------------------------------------------------------------------------- | --------------------------- |
| `arquiteto`     | Define contratos (interfaces, tipos, erros), pastas e ADRs antes de cada fase       | Só tipos/interfaces         |
| `dev-backend`   | Implementa seguindo os contratos, até os testes passarem                            | Sim                         |
| `testador`      | Escreve testes (unit/integração/e2e) a partir dos contratos, antes da implementação | Não (só testes)             |
| `engenheiro-ia` | Endpoint `/triagem`: prompt, adapter do LLM, tratamento de falhas                   | Sim (escopo triagem)        |
| `revisor`       | Revisa como o avaliador revisaria; aponta problemas, não corrige                    | Não                         |
| `documentador`  | README, ADRs, `.env.example`, guia de execução/deploy                               | Não (só docs)               |

Orquestração: **sequencial por fase** (arquiteto → testador → dev-backend → revisor → commit).
Paralelize apenas trabalho sem arquivos em comum (ex.: documentador enquanto testador escreve e2e).

## Fluxo de trabalho

1. Uma fase de `docs/plano.md` por vez. Não adiante fases nem crie arquivos de fases futuras.
2. Antes de codar, apresente o plano da fase (arquivos a criar/alterar) e aguarde aprovação.
3. Domínio e casos de uso em TDD: teste falhando → implementação mínima → refatorar.
4. Ao terminar: `npm run check` verde → subagente `revisor` → corrigir bloqueadores → commit.
5. Nunca marque um item como concluído sem o check verde.
6. Não instale dependências fora da stack acima sem perguntar.

## Definition of Done (por fase)

- `npm run check` passa sem erros e sem warnings
- Zero `any` (explícito ou implícito); zero `@ts-ignore`; `eslint-disable` só com comentário justificando
- Revisor sem bloqueadores
- `docs/plano.md` atualizado e commit feito com Conventional Commits
