import type { Doctor } from '../../domain/entities/doctor.entity';
import type { ScheduleRepository } from '../ports/schedule-repository.port';
import type { UseCase } from './use-case';

/**
 * Lista os médicos com seus horários disponíveis. Sem erros de negócio possíveis, por isso
 * não retorna `Result` (ADR-002).
 */
export class ListSchedulesUseCase implements UseCase<void, ReadonlyArray<Doctor>> {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  execute(): Promise<ReadonlyArray<Doctor>> {
    return this.scheduleRepository.list();
  }
}
