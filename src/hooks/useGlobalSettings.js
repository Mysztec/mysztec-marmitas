import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { db } from '@/api/client';
import { resolvePhase, toHHmm } from '@/lib/schedule';

/**
 * Configuracoes globais + fase atual do dia, recalculada a cada segundo.
 * A regra de fase mora em `@/lib/schedule` para poder ser testada isolada.
 */
export function useGlobalSettings() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['global-settings'],
    queryFn: () => db.entities.GlobalSettings.list(),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });

  // Relogio proprio: a fase muda com o tempo, nao com a chegada de dados.
  const [currentTime, setCurrentTime] = useState(() => toHHmm());
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(toHHmm()), 1000);
    return () => clearInterval(id);
  }, []);

  const settings = data[0] || {};
  const { phase, isReserveOpen, isPickupOpen, isLocked } = resolvePhase(settings, currentTime);

  return {
    settings,
    isLoading,
    isReserveOpen,
    isPickupOpen,
    isLocked,
    phase,
    preco_marmita: settings.preco_marmita || 0,
    taxa_nao_retirada: settings.taxa_nao_retirada || 0,
  };
}
