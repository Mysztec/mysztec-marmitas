import React from 'react';
import SettingsPanel from '../../components/admin/SettingsPanel';

export default function AdminSettings() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Preços, horários e dados do restaurante</p>
      </div>
      <SettingsPanel />
    </div>
  );
}