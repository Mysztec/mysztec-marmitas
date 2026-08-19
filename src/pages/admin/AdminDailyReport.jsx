import React from 'react';
import DailyReport from '../../components/admin/DailyReport';

export default function AdminDailyReport() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Relatório Diário</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Acompanhe as reservas do dia</p>
      </div>
      <DailyReport />
    </div>
  );
}