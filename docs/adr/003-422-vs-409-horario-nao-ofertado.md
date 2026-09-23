# ADR-003: 422 para horário nunca ofertado, 409 para horário ocupado

Status: aceito

## Contexto

O enunciado define só o 409 ("Horário indisponível") para conflito. Há um segundo caso que ele
não cobre: o cliente pede um horário bem formado que **nunca** esteve na agenda do médico
(ex.: `2026-06-10 13:00` para o médico 1). Os dois casos têm causas e correções diferentes para
o cliente.

## Decisão

Conforme D5:

- `SLOT_UNAVAILABLE` → **409 Conflict**: o horário existe, mas conflita com o estado atual do
  recurso (já reservado). O cliente deve escolher outro horário da agenda atual. O corpo é o texto
  exato do enunciado.
- `SLOT_NOT_OFFERED` → **422 Unprocessable Content**: o payload é sintaticamente válido (passou
  no 400), mas semanticamente inválido para esse médico. Não há conflito de estado, e repetir a
  requisição nunca vai dar certo.
- Para distinguir os casos, o `ScheduleRepository` guarda os horários **ofertados** e os
  **reservados** de cada médico (ADR-004). A precedência é: médico inexistente (404) → não
  ofertado (422) → ocupado (409).

## Alternativas consideradas

- **409 para os dois**: mais simples e aceitável segundo D5, mas mistura "alguém chegou antes"
  com "esse horário não existe" e dá ao cliente uma mensagem enganosa ("não está mais
  disponível" para algo que nunca esteve).
- **400 para não ofertado**: 400 fica reservado para payload malformado ou inválido pelo schema
  (D8). Esse caso depende do estado do servidor, não só do payload.
- **404 para não ofertado** (o "slot" como sub-recurso inexistente): confunde com médico
  inexistente, que já usa 404.

## Consequências

- A API ganha um status fora do enunciado (422). Ele fica documentado no README e na tabela de
  `docs/regras/api.md`.
- O repositório precisa lembrar dos horários reservados, não só removê-los da lista de
  disponíveis.
- Um horário já reservado continua dando 409 (e não 422), mesmo depois de sumir de
  `horarios_disponiveis`.
