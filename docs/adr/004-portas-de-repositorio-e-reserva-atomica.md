# ADR-004: Portas de repositório, reserva atômica e entrada do caso de uso

Status: aceito

## Contexto

`CreateAppointmentUseCase` precisa verificar a disponibilidade e reservar sem condição de corrida
(D14). Também precisa distinguir 404/422/409 (ADR-003) e devolver o nome do médico no 201. As
regras pedem portas pequenas e nenhum código morto.

## Decisão

- **`ScheduleRepository`** expõe só o que é usado:
  - `list(): Promise<ReadonlyArray<Doctor>>` (GET /agendas; depois, a triagem);
  - `reserveSlot(doctorId, slot): Promise<Result<Doctor, ReserveSlotError>>`, que é **atômica**:
    decide entre 404/422/409 e marca a reserva numa só operação. Em sucesso, devolve o médico já
    atualizado, que fornece o `doctorName` do agendamento.
  - Sem `findById`: nenhum caso de uso precisa dele, porque o `reserveSlot` já informa médico
    inexistente e devolve o médico. Um `findById` antes da reserva seria justamente o
    check-then-act que D14 proíbe.
- **Regra da reserva no domínio**: o agregado imutável `DoctorSchedule`
  (`src/domain/entities/doctor-schedule.entity.ts`) guarda horários ofertados e reservados e expõe
  `reserve(slot): Result<DoctorSchedule, SlotNotOfferedError | SlotUnavailableError>` (puro e
  síncrono) e `toDoctor()` (`availableSlots` = ofertados − reservados). É isso que permite o 422 e
  faz o horário sumir do GET (D6). O repositório só localiza o agregado (404), chama `reserve` e
  substitui a instância, tudo sem `await` no meio, o que mantém a operação atômica. Assim a regra
  de negócio é testada no domínio, sem repositório, e a infraestrutura não decide 422/409.
- **Portas assíncronas** (`Promise`), embora a implementação em memória seja síncrona: a porta
  não deve vazar a implementação, e uma troca por banco não mudaria a assinatura. Em memória, a
  atomicidade vem de não haver `await` entre a verificação e a marcação (event loop do Node).
- **`AppointmentRepository` só com `save`**: é o registro de quem reservou o quê. Sem ele, o
  paciente só existiria na resposta HTTP e o agendamento criado não seria persistido em lugar
  nenhum. Ele não é código morto: o caso de uso depende dele e os testes verificam a persistência
  pelo fake. A leitura (`findById`, listagem) entra quando houver endpoint que a exija (YAGNI).
- **`IdGenerator.generate(): string`** síncrono (UUID é CPU puro). `Logger` com
  `info/warn/error(message, context?)`.
- **Entrada do caso de uso com `slot: SlotDateTime`**, e não string ("parse, don't validate"):
  o schema HTTP (Fase 4) converte o texto usando `SlotDateTime.create`, que é a fonte única da
  regra de formato. Uma falha ali vira 400 com `detalhes`. Assim o caso de uso só recebe dados
  válidos por tipo, e a união de erros dele fica restrita aos três erros de negócio.
- **`Appointment` guarda `doctorId` + `doctorName`** (snapshot no momento da reserva), em vez de
  uma referência ao `Doctor` inteiro.
- **Entidades como `interface` readonly** (`docs/regras/typescript.md`). Hoje elas não têm
  comportamento próprio que justifique classe.

## Alternativas consideradas

- **`findById` + checagem no caso de uso + `markAsReserved`**: deixa a regra visível no caso de
  uso, mas cria uma janela de corrida entre a verificação e a escrita. Descartada (D14).
- **Regra 422/409 dentro da implementação de `reserveSlot`**: um tipo a menos, mas deixa regra de
  negócio na infraestrutura e obriga cada implementação (e cada fake) a reimplementá-la.
  Descartada em favor do agregado `DoctorSchedule`.
- **Um repositório único que reserva e grava o agendamento**: é atômico por construção, mas
  mistura agenda e registro de agendamentos (fere o I do SOLID).
- **Caso de uso recebendo `slot: string`**: auto-contido, mas duplica a validação da borda e
  obriga o mapeamento HTTP a tratar um `INVALID_SLOT_DATE_TIME` que nunca ocorre na prática.

## Consequências

- A decisão 422/409 fica em `DoctorSchedule.reserve` (testes de domínio); o repositório só
  decide o 404 e garante a atomicidade (testes na Fase 3). Fakes de teste reutilizam o agregado,
  sem duplicar a regra.
- Se `save` falhar depois de uma reserva bem-sucedida, o horário fica reservado sem agendamento.
  Em memória `save` não falha. Com um banco real, isso exigiria transação ou compensação
  (fora do escopo).
- O seed (Fase 3) cria `SlotDateTime` a partir de strings fixas. Uma falha ali é bug de dados e
  deve lançar na inicialização.
