import type { Container } from '../../../main/container';
import { container } from '../../../main/container';
import type { ApiGatewayHandler } from '../router';
import { createRouter } from '../router';

/** Função `schedule`: as duas rotas compartilham o estado em memória do container (D15, ADR-008). */
export function createScheduleHandler({
  scheduleController,
  logger,
}: Container): ApiGatewayHandler {
  return createRouter(
    {
      'GET /agendas': (request) => scheduleController.listSchedules(request),
      'POST /agendamento': (request) => scheduleController.createAppointment(request),
    },
    logger,
  );
}

export const handler = createScheduleHandler(container);
