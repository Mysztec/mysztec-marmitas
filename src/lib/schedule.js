/**
 * Regra de horario do sistema.
 *
 * O dia opera em fases: reserva -> espera -> retirada -> encerrado. Esta logica
 * estava embutida no hook `useGlobalSettings` e foi extraida para ca porque e a
 * regra de negocio mais importante do sistema e precisa ser testavel sem React.
 */

/** 'HH:mm' do horario informado (ou de agora). */
export const toHHmm = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const withinRange = (time, start, end) => {
  if (!start || !end) return false;
  return time >= start && time <= end;
};

/**
 * @returns {{ phase: 'locked'|'reserve'|'waiting'|'pickup'|'done',
 *             isReserveOpen: boolean, isPickupOpen: boolean, isLocked: boolean }}
 */
export function resolvePhase(settings = {}, currentTime = toHHmm()) {
  const isLocked = !!settings.trava_manual;

  const isReserveOpen =
    !isLocked && withinRange(currentTime, settings.reserva_inicio, settings.reserva_fim);
  const isPickupOpen =
    !isLocked && withinRange(currentTime, settings.retirada_inicio, settings.retirada_fim);

  // Janela morta entre o fim das reservas e o inicio da retirada.
  const isWaiting =
    !isLocked &&
    !!settings.reserva_fim &&
    !!settings.retirada_inicio &&
    currentTime > settings.reserva_fim &&
    currentTime < settings.retirada_inicio;

  let phase = 'done';
  if (isLocked) phase = 'locked';
  else if (isReserveOpen) phase = 'reserve';
  else if (isPickupOpen) phase = 'pickup';
  else if (isWaiting) phase = 'waiting';

  return { phase, isReserveOpen, isPickupOpen, isLocked };
}
