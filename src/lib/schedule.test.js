import { describe, expect, it } from 'vitest';
import { resolvePhase, toHHmm } from './schedule';

const HORARIO_PADRAO = {
  reserva_inicio: '07:00',
  reserva_fim: '10:00',
  retirada_inicio: '11:00',
  retirada_fim: '13:30',
};

describe('resolvePhase', () => {
  it('abre as reservas dentro da janela', () => {
    const { phase, isReserveOpen } = resolvePhase(HORARIO_PADRAO, '08:30');
    expect(phase).toBe('reserve');
    expect(isReserveOpen).toBe(true);
  });

  it('trata os limites da janela como inclusivos', () => {
    expect(resolvePhase(HORARIO_PADRAO, '07:00').phase).toBe('reserve');
    expect(resolvePhase(HORARIO_PADRAO, '10:00').phase).toBe('reserve');
    expect(resolvePhase(HORARIO_PADRAO, '13:30').phase).toBe('pickup');
  });

  it('entra em espera entre o fim da reserva e o inicio da retirada', () => {
    expect(resolvePhase(HORARIO_PADRAO, '10:30').phase).toBe('waiting');
  });

  it('abre a retirada dentro da janela', () => {
    const { phase, isPickupOpen } = resolvePhase(HORARIO_PADRAO, '12:00');
    expect(phase).toBe('pickup');
    expect(isPickupOpen).toBe(true);
  });

  it('encerra o dia depois da retirada', () => {
    expect(resolvePhase(HORARIO_PADRAO, '14:00').phase).toBe('done');
  });

  it('considera o periodo antes da abertura como encerrado, nao espera', () => {
    // 06:00 e antes de tudo: nao pode cair em 'waiting'.
    expect(resolvePhase(HORARIO_PADRAO, '06:00').phase).toBe('done');
  });

  it('a trava manual vence qualquer horario', () => {
    const travado = { ...HORARIO_PADRAO, trava_manual: true };
    const resultado = resolvePhase(travado, '08:30');
    expect(resultado.phase).toBe('locked');
    expect(resultado.isReserveOpen).toBe(false);
    expect(resultado.isPickupOpen).toBe(false);
  });

  it('nao quebra com configuracao vazia', () => {
    expect(resolvePhase({}, '08:30').phase).toBe('done');
    expect(resolvePhase(undefined, '08:30').phase).toBe('done');
  });

  it('nao entra em espera se faltar um dos limites', () => {
    const parcial = { reserva_fim: '10:00' };
    expect(resolvePhase(parcial, '10:30').phase).toBe('done');
  });
});

describe('toHHmm', () => {
  it('preenche com zero a esquerda', () => {
    expect(toHHmm(new Date(2026, 0, 1, 7, 5))).toBe('07:05');
    expect(toHHmm(new Date(2026, 0, 1, 13, 30))).toBe('13:30');
    expect(toHHmm(new Date(2026, 0, 1, 0, 0))).toBe('00:00');
  });
});
