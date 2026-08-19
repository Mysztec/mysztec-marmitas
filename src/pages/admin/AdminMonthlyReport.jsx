import React from 'react';
import MonthlyReport from '../../components/admin/MonthlyReport';

export default function AdminMonthlyReport() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Relatório Mensal</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Resumo completo por funcionário</p>
      </div>
      <MonthlyReport />
    </div>
  );
}