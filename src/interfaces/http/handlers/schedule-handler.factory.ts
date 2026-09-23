import type { Container } from '../../../main/container';
import type { ApiGatewayHandler } from '../router';
import { createRouter } from '../router';

/**
 * Função `schedule`: as três rotas compartilham o estado em memória do container (D15, ADR-008,
 * ADR-009). A triagem lê a mesma agenda que `/agendamento` reserva.
 *
 * Fica fora do entrypoint (`schedule-handler.ts`) para que importá-la não crie o container padrão:
 * os testes montam o handler com o próprio container, sem ler `process.env` (ADR-008).
 */
export function createScheduleHandler({
  scheduleController,
  triageController,
  logger,
}: Container): ApiGatewayHandler {
  return createRouter(
    {
      'GET /agendas': (request) => scheduleController.listSchedules(request),
      'POST /agendamento': (request) => scheduleController.createAppointment(request),
      'POST /triagem': (request) => triageController.suggestSpecialty(request),
    },
    logger,
  );
}
