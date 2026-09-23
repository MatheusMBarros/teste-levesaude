import { expectErr } from '../../../tests/helpers/result-assertions';
import { TriageUnavailableError } from '../../application/errors/triage-unavailable.error';
import { SPECIALTIES } from '../../domain/value-objects/specialty.value-object';
import { UnavailableTriageModel } from './unavailable-triage.model';

describe('UnavailableTriageModel', () => {
  it('retorna TriageUnavailableError missing_api_key (503) para qualquer relato', async () => {
    const sut = new UnavailableTriageModel();

    const error = expectErr(
      await sut.classify({
        symptoms: 'Sinto dor no peito ao subir escadas',
        allowedSpecialties: SPECIALTIES,
      }),
    );

    expect(error).toBeInstanceOf(TriageUnavailableError);
    expect(error).toMatchObject({ code: 'TRIAGE_UNAVAILABLE', reason: 'missing_api_key' });
  });
});
