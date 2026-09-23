import { slot } from '../../../tests/helpers/builders/slot';
import { DoctorNotFoundError } from './doctor-not-found.error';
import { DomainError } from './domain.error';
import { InvalidSlotDateTimeError } from './invalid-slot-date-time.error';
import { SlotNotOfferedError } from './slot-not-offered.error';
import { SlotUnavailableError } from './slot-unavailable.error';

interface DomainErrorCase {
  readonly className: string;
  readonly create: () => DomainError;
  readonly code: string;
  readonly context: () => Readonly<Record<string, unknown>>;
}

// Fábricas preguiçosas: `slot()` depende de SlotDateTime, então cada caso só é montado dentro do seu teste.
const cases: ReadonlyArray<DomainErrorCase> = [
  {
    className: 'DoctorNotFoundError',
    create: () => new DoctorNotFoundError(99),
    code: 'DOCTOR_NOT_FOUND',
    context: () => ({ doctorId: 99 }),
  },
  {
    className: 'SlotNotOfferedError',
    create: () => new SlotNotOfferedError(1, slot('2026-06-10 15:00')),
    code: 'SLOT_NOT_OFFERED',
    context: () => ({ doctorId: 1, slot: slot('2026-06-10 15:00') }),
  },
  {
    className: 'SlotUnavailableError',
    create: () => new SlotUnavailableError(1, slot('2026-06-10 09:00')),
    code: 'SLOT_UNAVAILABLE',
    context: () => ({ doctorId: 1, slot: slot('2026-06-10 09:00') }),
  },
  {
    className: 'InvalidSlotDateTimeError',
    create: () => new InvalidSlotDateTimeError('2026-02-30 10:00'),
    code: 'INVALID_SLOT_DATE_TIME',
    context: () => ({ value: '2026-02-30 10:00' }),
  },
];

describe('Erros de domínio', () => {
  it.each(cases)('$className expõe o code literal $code', ({ create, code }) => {
    const error = create();

    expect(error.code).toBe(code);
  });

  it.each(cases)('$className carrega o contexto do erro', ({ create, context }) => {
    const error = create();

    expect(error).toMatchObject(context());
  });

  it.each(cases)('$className tem name igual ao nome da classe', ({ create, className }) => {
    const error = create();

    expect(error.name).toBe(className);
  });

  it.each(cases)('$className é instância de DomainError e de Error', ({ create }) => {
    const error = create();

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
  });
});
