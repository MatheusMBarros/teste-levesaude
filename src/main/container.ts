import type { IdGenerator } from '../application/ports/id-generator.port';
import type { Logger } from '../application/ports/logger.port';
import type { TriageModel } from '../application/ports/triage-model.port';
import { CreateAppointmentUseCase } from '../application/use-cases/create-appointment.use-case';
import { ListSchedulesUseCase } from '../application/use-cases/list-schedules.use-case';
import { SuggestSpecialtyUseCase } from '../application/use-cases/suggest-specialty.use-case';
import { CryptoIdGenerator } from '../infrastructure/id-generator/crypto-id.generator';
import type { LogWriter } from '../infrastructure/logger/json.logger';
import { JsonLogger, stdoutWriter } from '../infrastructure/logger/json.logger';
import { createDoctorSchedules } from '../infrastructure/mocks/doctor-schedules.factory';
import { DOCTORS_SEED } from '../infrastructure/mocks/doctors.seed';
import { InMemoryAppointmentRepository } from '../infrastructure/repositories/in-memory-appointment.repository';
import { InMemoryScheduleRepository } from '../infrastructure/repositories/in-memory-schedule.repository';
import { ScheduleController } from '../interfaces/http/controllers/schedule.controller';
import { TriageController } from '../interfaces/http/controllers/triage.controller';
import type { Environment } from './env.schema';
import { loadTriageConfig } from './env.schema';
import { createTriageModel } from './triage-model.factory';

/**
 * Só o que os testes precisam trocar (ADR-008): ids previsíveis, captura de logs, ambiente da
 * triagem e, quando o teste precisa de um desfecho específico (504, 502, emergência), o modelo.
 */
export interface ContainerOptions {
  readonly idGenerator?: IdGenerator;
  readonly logWriter?: LogWriter;
  /**
   * Variáveis da triagem (D17). Obrigatório e sem padrão: só o entrypoint passa `process.env`;
   * os testes passam um ambiente explícito e não dependem do shell (ADR-008).
   */
  readonly env: Environment;
  /** Substitui o modelo escolhido por `env`; `env` nem é lido quando presente. */
  readonly triageModel?: TriageModel;
}

export interface Container {
  readonly logger: Logger;
  readonly scheduleController: ScheduleController;
  readonly triageController: TriageController;
}

/** Composition root: único lugar que instancia infraestrutura. Cada chamada tem estado próprio. */
export function createContainer(options: ContainerOptions): Container {
  const logger = new JsonLogger(options.logWriter ?? stdoutWriter);
  const scheduleRepository = new InMemoryScheduleRepository(createDoctorSchedules(DOCTORS_SEED));
  const createAppointment = new CreateAppointmentUseCase(
    scheduleRepository,
    new InMemoryAppointmentRepository(),
    options.idGenerator ?? new CryptoIdGenerator(),
  );
  const triageModel =
    options.triageModel ?? createTriageModel(loadTriageConfig(options.env), logger);

  return {
    logger,
    scheduleController: new ScheduleController(
      new ListSchedulesUseCase(scheduleRepository),
      createAppointment,
      logger,
    ),
    triageController: new TriageController(
      new SuggestSpecialtyUseCase(triageModel, scheduleRepository),
      logger,
    ),
  };
}
