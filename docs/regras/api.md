# Regras — Design de API

| Método | Rota         | Sucesso | Erros                   |
| ------ | ------------ | ------- | ----------------------- |
| GET    | /agendas     | 200     | 500                     |
| POST   | /agendamento | 201     | 400, 404, 409, 422, 500 |
| POST   | /triagem     | 200     | 400, 502, 503, 504, 500 |

- Contratos e textos de `docs/requisitos.md` são literais — não "melhore" chaves nem mensagens do enunciado.
- Todos as functions e variaveis devem ser escritas em ingles mantendo o padrão internacional
- Corpo de erro sempre `{ "erro": string, "mensagem": string, "detalhes"?: [{ "campo": string, "problema": string }] }`.
- JSON malformado ou body ausente → 400. O `Content-Type` da requisição não é exigido: o corpo é sempre lido como JSON (D24).
- Mensagens de validação em português, apontando o campo (`agendamento.medico_id`).
- Nunca vazar stack trace, mensagem de exceção interna ou detalhe do provedor de LLM.
- Headers: `Content-Type: application/json; charset=utf-8`. CORS habilitado nos eventos `http`.
- API Gateway **REST** (`events: - http:`). Não usar `httpApi`.
- Serverless-offline sem prefixo de stage para as URLs baterem com o enunciado.
- Timeouts: a função `schedule` tem 20 s porque atende também a triagem (ADR-009); o adapter do LLM limita cada chamada a 5 s e a triagem inteira a 17 s no pior caso (ADR-010), sempre abaixo do timeout da Lambda. Uma função só de CRUD usaria 6 s.
