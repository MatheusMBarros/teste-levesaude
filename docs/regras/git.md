# Regras — Git

- Conventional Commits em português: `feat(agendamento): valida conflito de horário`, `test(...)`, `chore(setup): ...`, `docs(readme): ...`, `refactor(...)`.
- Commits pequenos e lógicos (o histórico também é avaliado). Um commit por passo concluído, com `npm run check` verde.
- Nunca commitar `.env`, `node_modules`, `.serverless`, `.esbuild`, `coverage`.
- `.env.example` sempre atualizado com todas as variáveis (sem valores reais).
- Não fazer `git push`, reescrever histórico nem `deploy` sem pedido explícito.
