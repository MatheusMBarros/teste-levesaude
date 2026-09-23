# Regras — Testes

- Pirâmide: muitos unitários (domínio/casos de uso), alguns de integração (handler com evento fabricado), poucos e2e (serverless-offline + `fetch`).
- **Sem `jest.mock` de módulos** para dependências de negócio: use fakes que implementam as portas (`tests/helpers/fakes`). É isso que prova a inversão de dependência.
- Nomes: `describe('CreateAppointmentUseCase')` + `it('retorna SlotUnavailableError quando o horário já foi reservado')` (descrição em português, identificadores em inglês).
- Estrutura Arrange / Act / Assert, um comportamento por teste.
- Builders para dados (`aDoctor().withSlots([...]).build()`), sem objetos gigantes copiados.
- Fábrica de `APIGatewayProxyEvent` em `tests/helpers/api-gateway-event.ts` (tipos de `@types/aws-lambda`).
- Testes de integração assertam status **e** corpo exato dos contratos do enunciado.
- Nenhum teste faz chamada de rede real. O adapter Anthropic é testado com cliente injetado (stub tipado).
- Estado isolado: cada teste cria seu próprio container/repositório.
- Cobertura mínima: 90% linhas/branches em `src/domain` e `src/application` (threshold no Jest).
