# Regras — TypeScript

- `any` é proibido (explícito ou implícito). Dado externo entra como `unknown` e é estreitado via Zod ou type guards.
- Evite asserções `as` (exceto `as const`). Se inevitável, comente o porquê na mesma linha.
- Tipos de retorno explícitos em funções exportadas e métodos públicos.
- `interface` para contratos (portas, entidades); `type` para uniões, DTOs e tipos derivados.
- Schemas Zod são a fonte da verdade dos payloads: tipos via `z.infer`, nunca duplicados à mão.
- Propriedades de entidades são `readonly`; coleções expostas como `ReadonlyArray<T>`.
- Uniões discriminadas + `switch` exaustivo com `assertNever(x: never): never`.
- Generics onde há reuso real: `Result<T, E>`, `HttpResponse<TBody>`, `UseCase<TInput, TOutput>`, `Controller<TBody>`. Não criar generics decorativos.
- Sem `enum` do TS: use uniões de literais ou objetos `as const`.
- Sem `export default`. Um conceito principal por arquivo.
- Decorators: padrão TS 5 (sem `experimentalDecorators`), tipados com `ClassMethodDecoratorContext`.
- Nomenclatura:
  - arquivos kebab-case com sufixo de papel: `.use-case.ts`, `.repository.ts`, `.handler.ts`, `.controller.ts`, `.error.ts`, `.schema.ts`, `.presenter.ts`, `.spec.ts`
  - identificadores **sempre em inglês**, inclusive termos de domínio (`Doctor`, `Appointment`, `availableSlots`, `CreateAppointmentUseCase`) — ver glossário em `docs/requisitos.md` (D16)
  - português apenas no contrato HTTP (chaves snake_case do enunciado), mensagens ao usuário e descrições de testes
- Sem código morto, sem `console.log` (use a porta `Logger`), sem TODO sem issue/explicação.
