# Regras — Arquitetura

## Camadas e regra de dependência

Dependências apontam sempre para dentro: `interfaces → application → domain`. `infrastructure` implementa portas de `application`. `main` é o único lugar que conhece tudo.

```
src/
  domain/            # entidades, value objects, erros de domínio. Zero dependências externas.
    entities/
    value-objects/
    errors/
  application/       # casos de uso e portas (interfaces). Não conhece HTTP, AWS, Zod nem SDKs.
    ports/
    use-cases/
  infrastructure/    # implementações concretas das portas (in-memory, crypto, Anthropic, logger)
    repositories/
    mocks/
    llm/
  interfaces/http/   # tradução HTTP <-> casos de uso
    handlers/        # entrypoints Lambda (finos)
    controllers/     # classes com decorators
    decorators/
    schemas/         # Zod
    presenters/      # domínio -> contrato snake_case
    errors/          # mapeamento DomainError -> status HTTP
  shared/            # Result, assertNever (sem lógica de negócio)
  main/              # composition root: instancia e injeta dependências
tests/
  helpers/           # builders, fábrica de eventos API Gateway, fakes
  integration/
  e2e/
```

Testes unitários ficam ao lado do código (`*.spec.ts`).

## Handlers finos

Um handler só: recebe o evento → chama o controller do container → retorna. Nenhum `if` de negócio, nenhuma instância criada dentro dele.

`GET /agendas` e `POST /agendamento` ficam na **mesma função Lambda** (`schedule`) para compartilharem o estado em memória (D15). O handler despacha por uma tabela declarativa `resource + httpMethod` → método do controller; rota fora da tabela é erro de configuração (500). `POST /triagem` é uma função separada.

## Injeção de dependência

- Por construtor, dependendo de interfaces (portas). Casos de uso nunca fazem `new` de infraestrutura.
- `src/main/container.ts` cria tudo no escopo do módulo (reaproveitado entre invocações do mesmo container Lambda — é isso que mantém o estado em memória).
- Sem framework de DI: composição manual é suficiente e mais legível para o escopo.

## Erros como fluxo explícito

- Casos de uso retornam `Result<TOutput, TErro>` onde `TErro` é união de erros de domínio conhecidos. Não lançam para erros de negócio.
- Erros de domínio estendem `DomainError` (abstrato) com `readonly code` literal (`'SLOT_UNAVAILABLE'`, ...).
- `throw` fica reservado para falhas inesperadas (bugs, infra); essas viram 500 no decorator de erros.
- O mapeamento código → status HTTP é um `switch` exaustivo em `interfaces/http/errors`.

## SOLID (onde aparece)

- S: handler / controller / caso de uso / repositório / presenter com uma responsabilidade cada.
- O: novos provedores de LLM entram implementando `TriageModel`, sem alterar o caso de uso.
- L: `InMemory*Repository` e fakes de teste são intercambiáveis com qualquer implementação da porta.
- I: portas pequenas (`IdGenerator`, `ScheduleRepository`, `AppointmentRepository` separados).
- D: casos de uso dependem de abstrações; concretos só em `main/`.

## Transversais

Validação, logging e tradução de erros HTTP via decorators nos métodos dos controllers. Logging estruturado em JSON com `requestId` (do evento API Gateway).
