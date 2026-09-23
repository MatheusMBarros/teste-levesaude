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
    // Stub da etapa de contratos (Fase 2); implementado pelo dev-backend via TDD.
    // eslint-disable-next-line @typescript-eslint/no-meaningless-void-operator -- stub da etapa de contratos; removido na implementação (TDD)
    void this.scheduleRepository;
    throw new Error('Not implemented');
  }
}
