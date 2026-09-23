import type { Logger } from '../../../application/ports/logger.port';
import type {
  CreateAppointmentError,
  CreateAppointmentInput,
} from '../../../application/use-cases/create-appointment.use-case';
import type { UseCase } from '../../../application/use-cases/use-case';
import type { Appointment } from '../../../domain/entities/appointment.entity';
import type { Doctor } from '../../../domain/entities/doctor.entity';
import type { Result } from '../../../shared/result';
import type { WithLogger } from '../decorators/controller-method';
import { HandleHttpErrors } from '../decorators/handle-http-errors.decorator';
import { LogRequest } from '../decorators/log-request.decorator';
import { ValidateBody } from '../decorators/validate-body.decorator';
import { domainErrorResponse } from '../errors/domain-error.mapper';
import type { HttpRequest } from '../http-request';
import type { ErrorBody, HttpResponse } from '../http-response';
import { createdResponse, okResponse } from '../http-response';
import type { CreatedAppointmentBody } from '../presenters/appointment.presenter';
import { presentCreatedAppointment } from '../presenters/appointment.presenter';
import type { ScheduleListBody } from '../presenters/schedule.presenter';
import { presentSchedules } from '../presenters/schedule.presenter';
import { createAppointmentBody } from '../schemas/create-appointment.schema';

type ListSchedules = UseCase<void, ReadonlyArray<Doctor>>;
type CreateAppointment = UseCase<
  CreateAppointmentInput,
  Result<Appointment, CreateAppointmentError>
>;

/** `GET /agendas` e `POST /agendamento` (mesma função Lambda, D15). */
export class ScheduleController implements WithLogger {
  constructor(
    private readonly listSchedulesUseCase: ListSchedules,
    private readonly createAppointmentUseCase: CreateAppointment,
    readonly logger: Logger,
  ) {}

  @LogRequest
  @HandleHttpErrors
  async listSchedules(_request: HttpRequest): Promise<HttpResponse<ScheduleListBody | ErrorBody>> {
    const doctors = await this.listSchedulesUseCase.execute();
    return okResponse(presentSchedules(doctors));
  }

  @LogRequest
  @HandleHttpErrors
  @ValidateBody(createAppointmentBody)
  async createAppointment(
    request: HttpRequest,
  ): Promise<HttpResponse<CreatedAppointmentBody | ErrorBody>> {
    const { agendamento } = createAppointmentBody.of(request);
    const result = await this.createAppointmentUseCase.execute({
      doctorId: agendamento.medico_id,
      patient: agendamento.paciente,
      slot: agendamento.data_horario,
    });
    if (!result.ok) {
      return domainErrorResponse(result.error);
    }
    return createdResponse(presentCreatedAppointment(result.value));
  }
}
