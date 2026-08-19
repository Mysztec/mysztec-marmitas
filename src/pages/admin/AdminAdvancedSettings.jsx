import React from 'react';
import AdvancedSettings from '@/components/admin/AdvancedSettings';
import DailyReservationsManager from '@/components/admin/DailyReservationsManager';

export default function AdminAdvancedSettings() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações Avançadas</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Horários, valores e controle de fluxo do sistema</p>
      </div>
      <DailyReservationsManager />
      <AdvancedSettings />
    </div>
  );
}