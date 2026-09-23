# ADR-005: Infraestrutura em memória (seed, repositórios e logger)

Status: aceito

## Contexto

A Fase 3 implementa as portas da ADR-004 sem banco (dados mockados, D7). Há três escolhas que não
são óbvias: em que formato o seed chega ao repositório, como o repositório real se relaciona com
o fake já usado nos testes de caso de uso e como testar o logger sem `jest.mock` nem `console.log`.

## Decisão

- **Seed em texto, repositório recebe agregados.** `DOCTORS_SEED` (`src/infrastructure/mocks/doctors.seed.ts`)
  é uma lista de `DoctorSeed` com horários em texto, para o arquivo espelhar o enunciado.
  `createDoctorSchedules(seed)` converte cada item em `DoctorSchedule` via `SlotDateTime.create` e
  **lança** se algum horário for inválido (bug de dados, falha na inicialização, ADR-004).
  `InMemoryScheduleRepository` recebe `ReadonlyArray<DoctorSchedule>` no construtor: não conhece o
  formato do seed nem faz parsing. O composition root (Fase 4) faz a ligação.
- **Cópia defensiva no construtor.** O repositório copia o array recebido e só troca posições da
  própria cópia. Como `DoctorSchedule` é imutável, a cópia rasa basta: o array e o seed do chamador
  nunca são mutados. `list()` devolve um array novo de projeções `Doctor` a cada chamada, então
  quem lê não enxerga reservas posteriores nem altera o estado interno.
- **Atomicidade.** `reserveSlot` é síncrono por dentro (localiza → `DoctorSchedule.reserve` →
  substitui) e só embrulha o resultado em `Promise.resolve`. Não há `await` entre ler e gravar, então
  duas chamadas concorrentes não se intercalam no event loop (D14).
- **O fake de teste continua separado.** `FakeScheduleRepository` segue independente da
  implementação em memória: ele registra chamadas (para provar que não há check-then-act) e os
  testes de aplicação não passam a depender de código de infraestrutura. A duplicação é pequena
  (localizar, 404, substituir), porque a regra 422/409 já está no agregado nos dois casos.
- **Logger com writer injetado.** `JsonLogger` recebe `write: (line: string) => void` e um relógio
  `now: () => Date`. O logger entrega a linha **sem** `\n`: o terminador é responsabilidade do
  writer. Em produção, o composition root usa um `stdoutWriter` exportado de
  `src/infrastructure/logger` (Fase 4) que acrescenta o `\n` e chama `process.stdout.write` dentro de
  uma arrow function (solto, ele perde o `this`); o container nunca recebe `process.stdout.write`
  diretamente. Assim sai uma linha JSON por evento,
  que o CloudWatch indexa; em teste, uma função que acumula linhas num array. Falhas do próprio
  writer não são capturadas pelo logger (o writer de produção não lança). Os campos
  fixos (`level`, `timestamp`, `message`) prevalecem sobre chaves homônimas do contexto. Valores
  `Error` no contexto são serializados como `{ name, message, stack }`. Se o contexto não puder ser
  serializado, o logger não lança: escreve a linha sem ele.

## Alternativas consideradas

- **Repositório recebendo `DoctorSeed` e fazendo o parsing**: acopla o repositório ao formato do mock
  e impede os testes de montar agendas com horários já reservados pelo builder.
- **Seed já em `DoctorSchedule`**: dispensa a conversão, mas o arquivo deixa de ser lido como o JSON
  do enunciado.
- **Fake delegando para `InMemoryScheduleRepository` (ou sendo substituído por ele)**: elimina ~10
  linhas duplicadas, mas faz os testes unitários de aplicação dependerem da infraestrutura. Uma falha
  no repositório real quebraria testes de caso de uso pelo motivo errado.
- **`console.log`/`console.error` dentro do logger**: proibido pelas regras e exigiria `jest.spyOn`
  global nos testes. No runtime Node da Lambda, o `console` também acrescenta um prefixo de texto
  que quebra o JSON por linha.

## Consequências

- O estado vive enquanto o container Lambda ou o processo do serverless-offline estiver ativo (D7).
- Trocar o armazenamento por um banco muda só a implementação das portas e o composition root.
- O logger não filtra por nível (não há `LOG_LEVEL`). Se houver necessidade, o filtro entra no
  próprio `JsonLogger` sem mudar a porta.
