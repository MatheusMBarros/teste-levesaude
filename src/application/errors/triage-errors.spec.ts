import { DomainError } from '../../domain/errors/domain.error';
import { TriageInvalidResponseError } from './triage-invalid-response.error';
import { TriageTimeoutError } from './triage-timeout.error';
import { TriageUnavailableError } from './triage-unavailable.error';

describe('erros da triagem', () => {
  describe('TriageUnavailableError', () => {
    it.each(['missing_api_key', 'provider_unavailable', 'provider_rejected'] as const)(
      'é um DomainError com code TRIAGE_UNAVAILABLE e reason %s',
      (reason) => {
        const error = new TriageUnavailableError(reason);

        expect(error).toBeInstanceOf(DomainError);
        expect(error.code).toBe('TRIAGE_UNAVAILABLE');
        expect(error.reason).toBe(reason);
        expect(error.name).toBe('TriageUnavailableError');
      },
    );
  });

  describe('TriageTimeoutError', () => {
    it('é um DomainError com code TRIAGE_TIMEOUT e o timeout aplicado', () => {
      const error = new TriageTimeoutError(5_000);

      expect(error).toBeInstanceOf(DomainError);
      expect(error.code).toBe('TRIAGE_TIMEOUT');
      expect(error.timeoutMs).toBe(5_000);
      expect(error.name).toBe('TriageTimeoutError');
    });
  });

  describe('TriageInvalidResponseError', () => {
    it('é um DomainError com code TRIAGE_INVALID_RESPONSE e o número de saídas inválidas', () => {
      const error = new TriageInvalidResponseError(2);

      expect(error).toBeInstanceOf(DomainError);
      expect(error.code).toBe('TRIAGE_INVALID_RESPONSE');
      expect(error.invalidOutputs).toBe(2);
      expect(error.name).toBe('TriageInvalidResponseError');
    });
  });
});
