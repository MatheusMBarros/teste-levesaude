import { expectErr, expectOk } from '../../../tests/helpers/result-assertions';
import { TriageInvalidResponseError } from '../../application/errors/triage-invalid-response.error';
import type { TriageRequest } from '../../application/ports/triage-model.port';
import { SPECIALTIES } from '../../domain/value-objects/specialty.value-object';
import { FakeTriageModel } from './fake-triage.model';

function aRequest(symptoms: string): TriageRequest {
  return { symptoms, allowedSpecialties: SPECIALTIES };
}

describe('FakeTriageModel', () => {
  it('classifica o caso do contrato como Cardiologista, urgência media, com a justificativa do enunciado', async () => {
    const sut = new FakeTriageModel();

    const classification = expectOk(
      await sut.classify(aRequest('Sinto dor no peito ao subir escadas e palpitações')),
    );

    expect(classification).toEqual({
      specialty: 'Cardiologista',
      urgency: 'media',
      rationale: 'Dor no peito aos esforços e palpitações sugerem avaliação cardiológica.',
    });
  });

  it.each([
    ['palpitações', 'Tenho palpitações quando fico ansioso'],
    ['palpitacoes (sem acento)', 'Tenho palpitacoes quando fico ansioso'],
    ['DOR NO PEITO (maiúsculas)', 'DOR NO PEITO AO CAMINHAR'],
  ])('reconhece palavra-chave cardíaca com e sem acento: %s', async (_label, symptoms) => {
    const sut = new FakeTriageModel();

    const classification = expectOk(await sut.classify(aRequest(symptoms)));

    expect(classification.specialty).toBe('Cardiologista');
  });

  it.each([
    ['Dermatologista', 'Apareceram manchas vermelhas na pele que coçam muito'],
    ['Pediatra', 'Meu filho de 5 anos está com febre e tosse há dois dias'],
    ['Ortopedista', 'Estou com dor no joelho desde que torci jogando futebol'],
  ] as const)('sugere %s pelas palavras-chave do relato', async (specialty, symptoms) => {
    const sut = new FakeTriageModel();

    const classification = expectOk(await sut.classify(aRequest(symptoms)));

    expect(classification.specialty).toBe(specialty);
  });

  it.each([
    ['desmaio', 'Minha mãe teve um desmaio agora e não acorda direito'],
    ['falta de ar', 'Estou com muita falta de ar e os lábios ficando roxos'],
    ['convulsão', 'Meu irmão está tendo uma convulsão'],
    ['convulsao (sem acento)', 'Meu irmao esta tendo uma convulsao'],
  ])('classifica como emergencia quando há sinal de alerta (%s)', async (_label, symptoms) => {
    const sut = new FakeTriageModel();

    const classification = expectOk(await sut.classify(aRequest(symptoms)));

    expect(classification.urgency).toBe('emergencia');
  });

  it.each([
    [
      'dor forte no peito irradiando, com suor frio',
      'Dor forte no peito irradiando para o braço esquerdo com suor frio',
      'Cardiologista',
    ],
    [
      'suspeita de AVC com dormência súbita',
      'Tive um AVC? meu lado esquerdo está dormente de repente',
      'Clínico Geral',
    ],
    [
      'boca torta e fala enrolada',
      'Meu avô ficou com a boca torta e a fala enrolada',
      'Clínico Geral',
    ],
    ['infarto', 'Acho que estou tendo um infarto', 'Clínico Geral'],
    ['sangramento intenso', 'Estou com um sangramento intenso no corte da mão', 'Clínico Geral'],
  ] as const)(
    'classifica como emergencia com a especialidade mais relacionada (%s)',
    async (_label, symptoms, specialty) => {
      const sut = new FakeTriageModel();

      const classification = expectOk(await sut.classify(aRequest(symptoms)));

      expect(classification).toMatchObject({ specialty, urgency: 'emergencia' });
    },
  );

  it.each([
    ['"posso" não casa com "osso"', 'Tenho dor de cabeça e não posso dormir'],
    ['"bebe" (verbo) não casa com bebê', 'Meu marido bebe muito e está com tosse'],
  ])('casa só palavras inteiras: %s', async (_label, symptoms) => {
    const sut = new FakeTriageModel();

    const classification = expectOk(await sut.classify(aRequest(symptoms)));

    expect(classification).toMatchObject({ specialty: 'Clínico Geral', urgency: 'media' });
  });

  it('reconhece bebê como criança quando é o sujeito do relato', async () => {
    const sut = new FakeTriageModel();

    const classification = expectOk(
      await sut.classify(aRequest('O bebê está chorando muito e não mama')),
    );

    expect(classification.specialty).toBe('Pediatra');
  });

  it('sobe a urgência para alta com febre alta', async () => {
    const sut = new FakeTriageModel();

    const classification = expectOk(
      await sut.classify(aRequest('Estou com febre alta e tosse há 3 dias')),
    );

    expect(classification).toMatchObject({ specialty: 'Clínico Geral', urgency: 'alta' });
  });

  it('não classifica como emergência a dor no peito aos esforços com palpitações', async () => {
    const sut = new FakeTriageModel();

    const classification = expectOk(
      await sut.classify(aRequest('dor no peito ao subir escadas e palpitações')),
    );

    expect(classification.urgency).not.toBe('emergencia');
  });

  it('sugere Clínico Geral com urgência media (na dúvida, a mais alta) quando não reconhece nenhuma palavra-chave', async () => {
    const sut = new FakeTriageModel();

    const classification = expectOk(
      await sut.classify(aRequest('Tenho me sentido cansado e desanimado ultimamente')),
    );

    expect(classification.specialty).toBe('Clínico Geral');
    expect(classification.urgency).toBe('media');
  });

  it('devolve TriageInvalidResponseError quando a especialidade escolhida está fora de allowedSpecialties', async () => {
    const sut = new FakeTriageModel();

    const error = expectErr(
      await sut.classify({
        symptoms: 'Estou com dor no joelho desde que torci jogando futebol',
        allowedSpecialties: ['Cardiologista', 'Clínico Geral'],
      }),
    );

    expect(error).toBeInstanceOf(TriageInvalidResponseError);
  });

  it('respeita a lista reduzida quando a especialidade escolhida está nela', async () => {
    const sut = new FakeTriageModel();

    const classification = expectOk(
      await sut.classify({
        symptoms: 'Sinto dor no peito ao subir escadas e palpitações',
        allowedSpecialties: ['Cardiologista', 'Clínico Geral'],
      }),
    );

    expect(classification.specialty).toBe('Cardiologista');
  });

  it('sempre devolve especialidade da lista fechada e justificativa não vazia', async () => {
    const sut = new FakeTriageModel();

    const classification = expectOk(await sut.classify(aRequest('xyz xyz xyz xyz')));

    expect(SPECIALTIES).toContain(classification.specialty);
    expect(classification.rationale.trim()).not.toBe('');
  });

  it('é determinístico: o mesmo relato gera sempre a mesma classificação', async () => {
    const sut = new FakeTriageModel();
    const symptoms = 'Apareceram manchas vermelhas na pele que coçam muito';

    const first = await sut.classify(aRequest(symptoms));
    const second = await sut.classify(aRequest(symptoms));

    expect(second).toEqual(first);
  });
});
