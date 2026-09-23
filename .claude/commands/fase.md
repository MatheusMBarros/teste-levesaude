---
description: Executa uma fase do docs/plano.md com o fluxo de subagentes
argument-hint: <número da fase>
---

Vamos executar a Fase $ARGUMENTS de `docs/plano.md`.

1. Use o subagente `arquiteto` para produzir contratos, lista de arquivos, casos de teste esperados e ADRs da fase. Mostre o resultado e AGUARDE minha aprovação.
2. Após aprovação: use o subagente `testador` para escrever os testes (devem falhar).
3. Use o subagente `dev-backend` (ou `engenheiro-ia` na fase de triagem) para implementar até ficar verde.
4. Rode `npm run check`.
5. Use o subagente `revisor`. Corrija bloqueadores e rode o check de novo.
6. Atualize os checkboxes da fase em `docs/plano.md` e faça commits pequenos com Conventional Commits.
7. Termine com um resumo: o que foi feito, decisões tomadas, pendências.
