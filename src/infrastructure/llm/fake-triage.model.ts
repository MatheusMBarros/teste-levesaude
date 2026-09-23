import { TriageInvalidResponseError } from '../../application/errors/triage-invalid-response.error';
import type {
  TriageClassification,
  TriageError,
  TriageModel,
  TriageRequest,
} from '../../application/ports/triage-model.port';
import type { Specialty } from '../../domain/value-objects/specialty.value-object';
import type { Urgency } from '../../domain/value-objects/urgency.value-object';
import type { Result } from '../../shared/result';
import { err, ok } from '../../shared/result';

/*
 * Todos os padrões rodam sobre o relato normalizado (minúsculas, sem acento) e casam palavras
 * inteiras (`\b`): "posso" não casa "osso" e "bebe" (verbo) não casa "o bebê". Onde o paciente
 * costuma pôr palavras no meio ("dor forte no peito"), o padrão tolera um trecho curto (`.{0,20}`).
 */

interface KeywordRule {
  readonly patterns: ReadonlyArray<RegExp>;
  readonly specialty: Specialty;
  readonly urgency: Urgency;
  readonly rationale: string;
}

/** Sinais de alerta do prompt (ADR-011): decidem a urgência `emergencia`, qualquer que seja a regra. */
const EMERGENCY_PATTERNS: ReadonlyArray<RegExp> = [
  /\bdor\b.{0,20}\b(forte|intensa|muito forte|insuportavel)\b.{0,20}\bpeito\b/,
  /\bdor\b.{0,20}\bpeito\b.{0,20}\b(forte|intensa|insuportavel)\b/,
  /\baperto\b.{0,20}\bpeito\b/,
  /\birradi\w*/,
  /\bsuor(es)? frio\b/,
  /\binfart\w*/,
  /\bavc\b/,
  /\bderrame\b/,
  /\b(dormente|dormencia|formigamento|fraqueza)\b.{0,40}\b(de repente|subit[oa]|subitamente)\b/,
  /\b(de repente|subit[oa]|subitamente)\b.{0,40}\b(dormente|dormencia|formigamento|fraqueza)\b/,
  /\bboca torta\b/,
  /\bfala enrolada\b/,
  /\bfalta de ar\b/,
  /\bdesmai\w*/,
  /\bconvuls\w*/,
  /\bperd\w* (a |os )?(consciencia|sentidos)\b/,
  /\bsangramento\b.{0,20}\b(intenso|forte|que nao para)\b/,
  /\bsangrando muito\b/,
  /\bsuicid\w*/,
  /\b(me matar|tirar a minha vida|tirar minha vida)\b/,
];

/** Sinais que sobem a urgência para `alta` (critérios do prompt), sem ser emergência. */
const HIGH_URGENCY_PATTERNS: ReadonlyArray<RegExp> = [
  /\bfebre\b.{0,10}\b(alta|muito alta|de 39|de 40)\b/,
  /\b(39|40)([.,]\d)? ?(graus|°)/,
];

/** Regras em ordem de prioridade; a primeira que casar vence. */
const RULES: ReadonlyArray<KeywordRule> = [
  {
    patterns: [
      /\b(meu|minha|nosso|nossa) (filh[oa]|bebe|nenem|enteado|enteada)\b/,
      /\b(o|a|do|da|no|na) (bebe|nenem)\b/,
      /\bcriancas?\b/,
      /\bmenin[oa]s?\b/,
      /\brecem-nascid[oa]\b/,
    ],
    specialty: 'Pediatra',
    urgency: 'media',
    rationale: 'Relato referente a uma criança sugere avaliação pediátrica.',
  },
  {
    patterns: [
      /\bdor\b.{0,20}\bpeito\b/,
      /\baperto\b.{0,20}\bpeito\b/,
      /\bpalpitac\w*/,
      /\bcoracao (disparado|dispara|acelerado)\b/,
    ],
    specialty: 'Cardiologista',
    urgency: 'media',
    // Texto idêntico ao exemplo do contrato 3: o caso do enunciado reproduz o contrato sem chave.
    rationale: 'Dor no peito aos esforços e palpitações sugerem avaliação cardiológica.',
  },
  {
    patterns: [
      /\bmanchas?\b/,
      /\bpele\b/,
      /\bcoceira\b/,
      /\bcoca(m|ndo)?\b/,
      /\bacne\b/,
      /\bespinhas?\b/,
      /\bpintas?\b/,
    ],
    specialty: 'Dermatologista',
    urgency: 'baixa',
    rationale: 'Alterações na pele sugerem avaliação dermatológica eletiva.',
  },
  {
    patterns: [
      /\bjoelhos?\b/,
      /\btorc(i|eu)\b/,
      /\btornozelos?\b/,
      /\bfratur\w*/,
      /\bcoluna\b/,
      /\bossos?\b/,
      /\barticulac\w*/,
      /\bombros?\b/,
    ],
    specialty: 'Ortopedista',
    urgency: 'media',
    rationale: 'Dor em ossos ou articulações sugere avaliação ortopédica.',
  },
];

/** Nenhuma regra casou: "Clínico Geral" e, na dúvida, a urgência mais alta (regra 5 do prompt). */
const FALLBACK: KeywordRule = {
  patterns: [],
  specialty: 'Clínico Geral',
  urgency: 'media',
  rationale:
    'O relato não aponta uma especialidade específica; sugere avaliação inicial com clínico geral.',
};

const EMERGENCY_RATIONALE = 'O relato traz sinal de alerta que exige atendimento imediato.';

const HIGH_URGENCY_RATIONALE_SUFFIX = ' A intensidade relatada indica avaliação em até 48 horas.';

/** Minúsculas e sem acento: remove as marcas combinantes (`\p{M}`) após a decomposição NFD. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function matches(text: string, patterns: ReadonlyArray<RegExp>): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function urgencyOf(
  text: string,
  rule: KeywordRule,
): Pick<TriageClassification, 'urgency' | 'rationale'> {
  if (matches(text, EMERGENCY_PATTERNS)) {
    return { urgency: 'emergencia', rationale: EMERGENCY_RATIONALE };
  }
  if (matches(text, HIGH_URGENCY_PATTERNS)) {
    return { urgency: 'alta', rationale: `${rule.rationale}${HIGH_URGENCY_RATIONALE_SUFFIX}` };
  }
  return { urgency: rule.urgency, rationale: rule.rationale };
}

/**
 * Triagem determinística por palavras-chave (`TRIAGE_PROVIDER=fake`, D17): roda sem chave e sem
 * rede, para testes, e2e e execução local. Não é um classificador clínico; só permite exercitar o
 * fluxo inteiro com respostas previsíveis. Honra a porta como o adapter real: especialidade fora de
 * `allowedSpecialties` é saída inválida (`TriageInvalidResponseError`), sem fallback silencioso.
 */
export class FakeTriageModel implements TriageModel {
  classify(request: TriageRequest): Promise<Result<TriageClassification, TriageError>> {
    const text = normalize(request.symptoms);
    const rule = RULES.find((candidate) => matches(text, candidate.patterns)) ?? FALLBACK;

    if (!request.allowedSpecialties.includes(rule.specialty)) {
      return Promise.resolve(err(new TriageInvalidResponseError(1)));
    }
    return Promise.resolve(ok({ specialty: rule.specialty, ...urgencyOf(text, rule) }));
  }
}
