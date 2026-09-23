import { DomainError } from './domain.error';

export class DoctorNotFoundError extends DomainError {
  override readonly code = 'DOCTOR_NOT_FOUND';

  constructor(readonly doctorId: number) {
    super(`Doctor ${String(doctorId)} not found`);
  }
}
