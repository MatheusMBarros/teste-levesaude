# ADR-006: Idioma do código e do contrato HTTP

Status: aceito

## Contexto

O enunciado define o contrato HTTP em português e snake_case (`medico_id`, `horarios_disponiveis`,
`mensagem`), enquanto o padrão de mercado para código é inglês. A regra anterior em
`docs/regras/typescript.md` listava onde o português era permitido de forma incompleta: não citava
comentários, documentação nem valores de domínio exibidos ao usuário, que já estavam em português
no código.

## Decisão

- Identificadores (classes, tipos, funções, variáveis, chaves internas, arquivos, env vars) em
  **inglês**, seguindo o glossário de `docs/requisitos.md` (D16).
- Contrato HTTP em **português snake_case**, literal do enunciado. A tradução para o modelo interno
  camelCase fica só na camada HTTP: presenters na saída, schemas/controllers na entrada (D11).
- Português também em mensagens ao usuário, valores de domínio que aparecem no contrato (ex.:
  `SPECIALTIES`: `'Clínico Geral'`), descrições de testes, comentários e documentação.
- Mensagens de exceções internas, que nunca chegam ao cliente (D9), em inglês.

## Consequências

- O domínio fica legível para qualquer desenvolvedor e desacoplado do formato do contrato: mudar
  uma chave do JSON afeta só presenters/schemas.
- Os valores de `SPECIALTIES` são dados, não identificadores: ficam em português porque são o texto
  do contrato; as chaves do objeto seguem em inglês.
- Convivem dois idiomas no repositório; a regra acima diz qual usar em cada lugar.
