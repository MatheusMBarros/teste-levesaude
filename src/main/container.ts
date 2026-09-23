import type { IdGenerator } from '../application/ports/id-generator.port';
import type { Logger } from '../application/ports/logger.port';
import { CreateAppointmentUseCase } from '../application/use-cases/create-appointment.use-case';
import { ListSchedulesUseCase } from '../application/use-cases/list-schedules.use-case';
import { CryptoIdGenerator } from '../infrastructure/id-generator/crypto-id.generator';
import type { LogWriter } from '../infrastructure/logger/json.logger';
import { JsonLogger, stdoutWriter } from '../infrastructure/logger/json.logger';
import { createDoctorSchedules } from '../infrastructure/mocks/doctor-schedules.factory';
import { DOCTORS_SEED } from '../infrastructure/mocks/doctors.seed';
import { InMemoryAppointmentRepository } from '../infrastructure/repositories/in-memory-appointment.repository';
import { InMemoryScheduleRepository } from '../infrastructure/repositories/in-memory-schedule.repository';
import { ScheduleController } from '../interfaces/http/controllers/schedule.controller';

/** Só o que os testes precisam trocar: ids previsíveis e captura de logs (ADR-008). */
export interface ContainerOptions {
  readonly idGenerator?: IdGenerator;
  readonly logWriter?: LogWriter;
}

export interface Container {
  readonly logger: Logger;
  readonly scheduleController: ScheduleController;
}

/** Composition root: único lugar que instancia infraestrutura. Cada chamada tem estado próprio. */
export function createContainer(options: ContainerOptions = {}): Container {
  const logger = new JsonLogger(options.logWriter ?? stdoutWriter);
  const scheduleRepository = new InMemoryScheduleRepository(createDoctorSchedules(DOCTORS_SEED));
  const createAppointment = new CreateAppointmentUseCase(
    scheduleRepository,
    new InMemoryAppointmentRepository(),
    options.idGenerator ?? new CryptoIdGenerator(),
  );

  return {
    logger,
    scheduleController: new ScheduleController(
      new ListSchedulesUseCase(scheduleRepository),
      createAppointment,
      logger,
    ),
  };
}

// Escopo de módulo: reaproveitado entre invocações do mesmo container Lambda, mantém o estado (D7).
export const container = createContainer();
