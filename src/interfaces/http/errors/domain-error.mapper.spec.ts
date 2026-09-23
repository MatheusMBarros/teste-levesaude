import { slot } from '../../../../tests/helpers/builders/slot';
import { TriageInvalidResponseError } from '../../../application/errors/triage-invalid-response.error';
import { TriageTimeoutError } from '../../../application/errors/triage-timeout.error';
import { TriageUnavailableError } from '../../../application/errors/triage-unavailable.error';
import { DoctorNotFoundError } from '../../../domain/errors/doctor-not-found.error';
import { SlotNotOfferedError } from '../../../domain/errors/slot-not-offered.error';
import { SlotUnavailableError } from '../../../domain/errors/slot-unavailable.error';
import { DEFAULT_HEADERS } from '../http-response';
import type { MappedDomainError } from './domain-error.mapper';
import { domainErrorResponse } from './domain-error.mapper';

const SLOT = slot('2026-06-10 09:00');

describe('domainErrorResponse', () => {
  it.each<[string, MappedDomainError, number, { erro: string; mensagem: string }]>([
    [
      'DoctorNotFoundError em 404 (D4)',
      new DoctorNotFoundError(99),
      404,
      { erro: 'Médico não encontrado', mensagem: 'O médico informado não existe.' },
    ],
    [
      'SlotNotOfferedError em 422 (D5)',
      new SlotNotOfferedError(1, SLOT),
      422,
      {
        erro: 'Horário não ofertado',
        mensagem: 'O horário solicitado não faz parte da agenda deste médico.',
      },
    ],
    [
      'SlotUnavailableError em 409 com o texto exato do enunciado',
      new SlotUnavailableError(1, SLOT),
      409,
      {
        erro: 'Horário indisponível',
        mensagem: 'O horário solicitado não está mais disponível para este médico.',
      },
    ],
    [
      'TriageUnavailableError em 503',
      new TriageUnavailableError('missing_api_key'),
      503,
      {
        erro: 'Triagem indisponível',
        mensagem:
          'O serviço de triagem está temporariamente indisponível. Tente novamente mais tarde. Em caso de emergência, ligue 192.',
      },
    ],
    [
      'TriageInvalidResponseError em 502',
      new TriageInvalidResponseError(2),
      502,
      {
        erro: 'Resposta inválida da triagem',
        mensagem:
          'Não foi possível interpretar a sugestão da triagem. Tente novamente. Em caso de emergência, ligue 192.',
      },
    ],
    [
      'TriageTimeoutError em 504',
      new TriageTimeoutError(5_000),
      504,
      {
        erro: 'Tempo esgotado na triagem',
        mensagem:
          'A triagem demorou mais que o esperado. Tente novamente. Em caso de emergência, ligue 192.',
      },
    ],
  ])('mapeia %s', (_label, error, statusCode, body) => {
    const response = domainErrorResponse(error);

    expect(response).toEqual({ statusCode, headers: DEFAULT_HEADERS, body });
  });

  it('não expõe a mensagem técnica do erro de domínio', () => {
    const error = new DoctorNotFoundError(99);

    const response = domainErrorResponse(error);

    expect(JSON.stringify(response)).not.toContain(error.message);
  });

  it.each(['missing_api_key', 'provider_unavailable', 'provider_rejected'] as const)(
    'responde o mesmo 503 para TriageUnavailableError com reason %s, sem expor o motivo',
    (reason) => {
      const response = domainErrorResponse(new TriageUnavailableError(reason));

      expect(response.statusCode).toBe(503);
      expect(JSON.stringify(response)).not.toContain(reason);
    },
  );
});
