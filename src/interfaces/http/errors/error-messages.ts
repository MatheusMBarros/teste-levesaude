/**
 * Textos `erro`/`mensagem` do contrato de erro. Fonte única para os builders de resposta; os
 * testes de integração **não** importam daqui: assertam os literais, para provar o contrato.
 * 404/409/422: textos de `docs/requisitos.md` (D4, D5, contrato 2). 400/500: D8/D9.
 * 502/503/504: triagem (contrato 3, ADR-010); todos lembram o 192, porque quem pede triagem pode
 * estar numa emergência.
 */
export const ERROR_MESSAGES = {
  invalidPayload: {
    erro: 'Payload inválido',
    mensagem: 'O corpo da requisição é inválido. Verifique os detalhes.',
  },
  doctorNotFound: {
    erro: 'Médico não encontrado',
    mensagem: 'O médico informado não existe.',
  },
  slotNotOffered: {
    erro: 'Horário não ofertado',
    mensagem: 'O horário solicitado não faz parte da agenda deste médico.',
  },
  slotUnavailable: {
    erro: 'Horário indisponível',
    mensagem: 'O horário solicitado não está mais disponível para este médico.',
  },
  triageUnavailable: {
    erro: 'Triagem indisponível',
    mensagem:
      'O serviço de triagem está temporariamente indisponível. Tente novamente mais tarde. Em caso de emergência, ligue 192.',
  },
  triageInvalidResponse: {
    erro: 'Resposta inválida da triagem',
    mensagem:
      'Não foi possível interpretar a sugestão da triagem. Tente novamente. Em caso de emergência, ligue 192.',
  },
  triageTimeout: {
    erro: 'Tempo esgotado na triagem',
    mensagem:
      'A triagem demorou mais que o esperado. Tente novamente. Em caso de emergência, ligue 192.',
  },
  internalError: {
    erro: 'Erro interno',
    mensagem: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
  },
} as const;
