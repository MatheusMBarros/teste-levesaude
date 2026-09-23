import type { LogContext } from '../../application/ports/logger.port';
import { JsonLogger } from './json.logger';

const FIXED_NOW = new Date('2026-06-10T12:34:56.789Z');

function makeSut(): { sut: JsonLogger; lines: string[] } {
  const lines: string[] = [];
  const sut = new JsonLogger(
    (line) => {
      lines.push(line);
    },
    () => FIXED_NOW,
  );
  return { sut, lines };
}

function parseLine(line: string | undefined): unknown {
  if (line === undefined) {
    throw new Error('Nenhuma linha de log foi escrita');
  }
  return JSON.parse(line);
}

describe('JsonLogger', () => {
  it('escreve exatamente uma linha JSON por chamada', () => {
    const { sut, lines } = makeSut();

    sut.info('primeiro');
    sut.warn('segundo');

    expect(lines).toHaveLength(2);
    expect(lines.every((line) => !line.includes('\n'))).toBe(true);
    expect(() => lines.map((line) => parseLine(line))).not.toThrow();
  });

  it.each(['info', 'warn', 'error'] as const)('registra o nível "%s"', (level) => {
    const { sut, lines } = makeSut();

    sut[level]('mensagem');

    expect(parseLine(lines[0])).toMatchObject({ level });
  });

  it('inclui a mensagem e o timestamp ISO do relógio injetado', () => {
    const { sut, lines } = makeSut();

    sut.info('agendamento criado');

    expect(parseLine(lines[0])).toEqual({
      level: 'info',
      timestamp: '2026-06-10T12:34:56.789Z',
      message: 'agendamento criado',
    });
  });

  it('usa o relógio do sistema quando nenhum é injetado', () => {
    const lines: string[] = [];
    const sut = new JsonLogger((line) => {
      lines.push(line);
    });

    sut.info('sem relógio');

    expect(parseLine(lines[0])).toMatchObject({
      // `expect.stringMatching` é tipado como `any`; `as unknown` evita propagá-lo (no-unsafe-assignment).
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/) as unknown,
    });
  });

  it('achata os campos do contexto no nível raiz da linha', () => {
    const { sut, lines } = makeSut();

    sut.info('requisição recebida', { requestId: 'req-1', doctorId: 1 });

    expect(parseLine(lines[0])).toEqual({
      requestId: 'req-1',
      doctorId: 1,
      level: 'info',
      timestamp: '2026-06-10T12:34:56.789Z',
      message: 'requisição recebida',
    });
  });

  it('faz os campos fixos prevalecerem sobre chaves homônimas do contexto', () => {
    const { sut, lines } = makeSut();

    sut.warn('mensagem real', {
      level: 'debug',
      timestamp: 'ontem',
      message: 'mensagem falsa',
      requestId: 'req-2',
    });

    expect(parseLine(lines[0])).toEqual({
      requestId: 'req-2',
      level: 'warn',
      timestamp: '2026-06-10T12:34:56.789Z',
      message: 'mensagem real',
    });
  });

  it('serializa Error do contexto com name, message e stack', () => {
    const { sut, lines } = makeSut();
    const failure = new TypeError('falha inesperada');

    sut.error('erro não tratado', { error: failure });

    expect(parseLine(lines[0])).toMatchObject({
      error: { name: 'TypeError', message: 'falha inesperada', stack: failure.stack },
    });
  });

  it('não lança e escreve a linha sem o contexto quando ele não é serializável', () => {
    const { sut, lines } = makeSut();
    const circular: Record<string, unknown> = { requestId: 'req-3' };
    circular.self = circular;
    const context: LogContext = circular;

    const act = (): void => {
      sut.error('contexto circular', context);
    };

    expect(act).not.toThrow();
    expect(parseLine(lines[0])).toEqual({
      level: 'error',
      timestamp: '2026-06-10T12:34:56.789Z',
      message: 'contexto circular',
    });
  });
});
