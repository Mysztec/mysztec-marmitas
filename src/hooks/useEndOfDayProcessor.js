import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/client';
import { format } from 'date-fns';
import { useGlobalSettings } from './useGlobalSettings';

/**
 * Roda em background: quando o horário atual passa de retirada_fim,
 * marca todas as reservas do dia com status='reserved' como 'not_picked_up'.
 * Executa apenas uma vez por sessão para não sobrecarregar a API.
 */
export function useEndOfDayProcessor() {
  const { settings, phase } = useGlobalSettings();
  const queryClient = useQueryClient();
  const processedRef = useRef(false);

  useEffect(() => {
    // Só processa quando a fase é 'done' (após retirada_fim) e ainda não foi processado
    if (phase !== 'done' || processedRef.current) return;
    if (!settings.retirada_fim) return;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Garante que retirada_fim já passou
    if (currentTime <= settings.retirada_fim) return;

    processedRef.current = true;
    const today = format(now, 'yyyy-MM-dd');

    (async () => {
      try {
        const pending = await db.entities.MealReservation.filter({
          date: today,
          status: 'reserved',
        });

        if (pending.length === 0) return;

        await Promise.all(
          pending.map(r =>
            db.entities.MealReservation.update(r.id, {
              status: 'not_picked_up',
            })
          )
        );

        queryClient.invalidateQueries({ queryKey: ['reservations'] });
        queryClient.invalidateQueries({ queryKey: ['reservations-report'] });
        queryClient.invalidateQueries({ queryKey: ['reservations-monthly'] });
      } catch (e) {
        console.error('Erro ao processar fim do dia:', e);
        processedRef.current = false; // permite nova tentativa
      }
    })();
  }, [phase, settings.retirada_fim]);
}