import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/client';
import { useState } from 'react';

/**
 * Hook que centraliza a lógica de escopo por unidade.
 * - Admin: pode selecionar qualquer unidade ou "todas" (selectedUnitId = null)
 * - Usuário comum: forçado à unidade vinculada ao seu perfil
 */
export function useUnitScope() {
  const [selectedUnitId, setSelectedUnitId] = useState(null); // null = todas (admin only)

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => db.auth.me(),
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ['unidades'],
    queryFn: () => db.entities.Unidade.list(),
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'dono';

  // Para usuário comum, a unidade é sempre a vinculada ao perfil dele
  const effectiveUnitId = isAdmin ? selectedUnitId : (user?.unidade_id || null);

  return {
    user,
    isAdmin,
    unidades,
    selectedUnitId: effectiveUnitId,
    setSelectedUnitId: isAdmin ? setSelectedUnitId : () => {},
    // Aplica filtro de unidade a um array de objetos com campo unidade_id
    filterByUnit: (items) => {
      if (!effectiveUnitId) return items; // admin vendo "todas"
      return items.filter(item => item.unidade_id === effectiveUnitId);
    },
  };
}