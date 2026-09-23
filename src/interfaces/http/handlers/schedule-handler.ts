import { createContainer } from '../../../main/container';
import { createScheduleHandler } from './schedule-handler.factory';

/*
 * Entrypoint Lambda da função `schedule` (`serverless.yml`: `schedule-handler.handler`). O container
 * é criado no escopo do módulo, uma vez por container Lambda: é isso que mantém o estado em memória
 * entre invocações (D7). Só este módulo lê `process.env`; os testes importam a fábrica.
 */
const container = createContainer({ env: process.env });

export const handler = createScheduleHandler(container);
