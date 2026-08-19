import React from 'react';
import UnidadeManager from '@/components/admin/UnidadeManager';

export default function AdminUnidades() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Unidades / Barracões</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Gerencie as unidades da empresa</p>
      </div>
      <UnidadeManager />
    </div>
  );
}