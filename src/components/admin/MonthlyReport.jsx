import React, { useState, useMemo } from 'react';
import { db } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { FileDown } from 'lucide-react';
import { exportPayrollCsv, downloadCsv } from '@/lib/exportCsv';
import { escapeHtml } from '@/lib/escapeHtml';

function generateMonthlyPDF(employeeStats, reservations, appSettings, globalSettings, month) {
  const mealPrice = globalSettings.preco_marmita || 0;
  const fee = globalSettings.taxa_nao_retirada || 0;

  const rows = employeeStats.map(s => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td style="text-align:center">${s.total}</td>
      <td style="text-align:center;color:#16a34a">${s.pickedUp}</td>
      <td style="text-align:center;color:#dc2626">${s.notPickedUp}</td>
      <td style="text-align:right">R$ ${(s.total * mealPrice).toFixed(2)}</td>
      <td style="text-align:right;color:#dc2626">R$ ${(s.notPickedUp * fee).toFixed(2)}</td>
    </tr>`).join('');

  const grandTotal = employeeStats.reduce((acc, s) => acc + s.total * mealPrice, 0);
  const grandFee = employeeStats.reduce((acc, s) => acc + s.notPickedUp * fee, 0);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Relatório Mensal - ${month}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
    .stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .stat { background: #f5f5f5; border-radius: 10px; padding: 14px 20px; min-width: 140px; }
    .stat-label { font-size: 12px; color: #666; }
    .stat-value { font-size: 24px; font-weight: bold; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f0f0f0; text-align: left; padding: 10px 12px; font-weight: 600; }
    td { padding: 10px 12px; border-bottom: 1px solid #eee; }
    .total-row td { font-weight: bold; background: #f9f9f9; }
  </style>
  </head><body>
  <h1>Relatório Mensal de Marmitas</h1>
  <div class="subtitle">${month}${appSettings.restaurant_name ? ' · ' + appSettings.restaurant_name : ''}</div>
  <div class="stats">
    <div class="stat"><div class="stat-label">Total de marmitas</div><div class="stat-value">${reservations.length}</div></div>
    <div class="stat"><div class="stat-label">Valor total</div><div class="stat-value" style="color:#ea7c34">R$ ${grandTotal.toFixed(2)}</div></div>
    <div class="stat"><div class="stat-label">Total taxas</div><div class="stat-value" style="color:#dc2626">R$ ${grandFee.toFixed(2)}</div></div>
  </div>
  <table>
    <thead><tr><th>Funcionário</th><th style="text-align:center">Reservas</th><th style="text-align:center">Retiradas</th><th style="text-align:center">Não retiradas</th><th style="text-align:right">Valor</th><th style="text-align:right">Taxas</th></tr></thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td>Total</td>
        <td style="text-align:center">${reservations.length}</td>
        <td style="text-align:center;color:#16a34a">${reservations.filter(r => r.status === 'picked_up').length}</td>
        <td style="text-align:center;color:#dc2626">${reservations.filter(r => r.status === 'not_picked_up').length}</td>
        <td style="text-align:right">R$ ${grandTotal.toFixed(2)}</td>
        <td style="text-align:right;color:#dc2626">R$ ${grandFee.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  </body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) win.addEventListener('load', () => win.print());
}

const MONTHS = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' }, { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export default function MonthlyReport() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'MM'));
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [filterEmployee, setFilterEmployee] = useState('__all__');
  const [filterUnidade, setFilterUnidade] = useState('__all__');

  const month = `${selectedYear}-${selectedMonth}`;

  const [year, monthNum] = month.split('-').map(Number);
  const startDate = `${month}-01`;
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

  const { selectedUnitId } = useOutletContext() || {};

  const { data: allReservations = [] } = useQuery({
    queryKey: ['reservations-monthly', month, selectedUnitId],
    queryFn: async () => {
      const all = await db.entities.MealReservation.list('-date', 5000);
      return all.filter(r => {
        const inRange = r.date >= startDate && r.date <= endDate;
        const inUnit = !selectedUnitId || r.unidade_id === selectedUnitId;
        return inRange && inUnit;
      });
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-all'],
    queryFn: () => db.entities.Employee.list(),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => db.entities.AppSettings.list(),
  });

  const { data: globalSettingsArr = [] } = useQuery({
    queryKey: ['global-settings'],
    queryFn: () => db.entities.GlobalSettings.list(),
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ['unidades'],
    queryFn: () => db.entities.Unidade.list(),
  });

  const appSettings = settings[0] || {};
  const globalSettings = globalSettingsArr[0] || {};
  const mealPrice = globalSettings.preco_marmita || 0;
  const fee = globalSettings.taxa_nao_retirada || 0;

  // Aplica filtros de unidade e funcionário
  const filteredReservations = useMemo(() =>
    allReservations
      .filter(r => filterUnidade === '__all__' || r.unidade_id === filterUnidade)
      .filter(r => filterEmployee === '__all__' || r.employee_name === filterEmployee),
    [allReservations, filterUnidade, filterEmployee]
  );

  const employeeOptions = useMemo(() =>
    [...new Set(allReservations.map(r => r.employee_name))].sort(),
    [allReservations]
  );

  // Agrega estatísticas por funcionário
  const employeeStats = useMemo(() => {
    const empMap = Object.fromEntries(employees.map(e => [e.id, e]));
    const stats = {};
    filteredReservations.forEach(r => {
      if (!stats[r.employee_id]) {
        const emp = empMap[r.employee_id];
        stats[r.employee_id] = {
          name: r.employee_name,
          department: emp?.department || '',
          unidade_id: r.unidade_id || '',
          total: 0, pickedUp: 0, notPickedUp: 0,
        };
      }
      stats[r.employee_id].total++;
      if (r.status === 'picked_up') stats[r.employee_id].pickedUp++;
      if (r.status === 'not_picked_up') stats[r.employee_id].notPickedUp++;
    });
    return Object.values(stats).filter(s => s.total > 0).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [filteredReservations, employees]);

  const grandTotal = employeeStats.reduce((acc, s) => acc + s.total * mealPrice, 0);
  const grandFee = employeeStats.reduce((acc, s) => acc + s.notPickedUp * fee, 0);

  const unidadeMap = Object.fromEntries(unidades.map(u => [u.id, u.nome]));

  // Exportação CSV para folha de pagamento (RH)
  const handleExportPayroll = () => {
    const rows = employeeStats.map(s => ({
      name: s.name,
      department: s.department,
      period: month,
      total: s.total,
      pickedUp: s.pickedUp,
      notPickedUp: s.notPickedUp,
      valorMarmitas: s.total * mealPrice,
      taxa: s.notPickedUp * fee,
    }));
    exportPayrollCsv(rows, `folha-marmitas-${month}.csv`);
  };

  // Exportação CSV detalhada (todas as reservas)
  const handleExportDetailed = () => {
    const hasFees = filteredReservations.some(r => r.status === 'not_picked_up');
    const header = ['Data', 'Funcionário', 'Status', 'Hora Reserva', 'Hora Retirada', 'Valor (R$)',
      ...(hasFees ? ['Desconto Indisciplina/Taxa (R$)'] : [])];
    const rows = filteredReservations.map(r => [
      r.date,
      r.employee_name,
      r.status === 'picked_up' ? 'Retirado' : r.status === 'not_picked_up' ? 'Não retirado' : 'Reservado',
      r.reserved_at ? format(new Date(r.reserved_at), 'HH:mm') : '',
      r.picked_up_at ? format(new Date(r.picked_up_at), 'HH:mm') : '',
      mealPrice.toFixed(2),
      ...(hasFees ? [r.status === 'not_picked_up' ? fee.toFixed(2) : '0.00'] : []),
    ]);
    downloadCsv([header, ...rows], `marmitas-detalhado-${month}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Mês</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Ano</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-24 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {!selectedUnitId && unidades.length > 0 && (
          <div className="space-y-1">
            <Label>Unidade</Label>
            <Select value={filterUnidade} onValueChange={setFilterUnidade}>
              <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {unidades.map(u => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label>Funcionário</Label>
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {employeeOptions.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 ml-auto">
          <Button onClick={() => generateMonthlyPDF(employeeStats, filteredReservations, appSettings, globalSettings, month)} variant="outline" className="rounded-xl gap-2" disabled={filteredReservations.length === 0}>
            <FileDown className="w-4 h-4" /> PDF
          </Button>
          <Button onClick={handleExportDetailed} variant="outline" className="rounded-xl gap-2" disabled={filteredReservations.length === 0}>
            <FileDown className="w-4 h-4" /> CSV Detalhado
          </Button>
          <Button onClick={handleExportPayroll} className="rounded-xl gap-2" disabled={employeeStats.length === 0}>
            <FileDown className="w-4 h-4" /> CSV Folha RH
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="rounded-2xl"><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Total de marmitas</p>
          <p className="text-3xl font-bold mt-1">{filteredReservations.length}</p>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Valor total</p>
          <p className="text-3xl font-bold text-primary mt-1">R$ {grandTotal.toFixed(2)}</p>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Desconto Indisciplina/Taxa</p>
          <p className="text-3xl font-bold text-destructive mt-1">R$ {grandFee.toFixed(2)}</p>
        </CardContent></Card>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Funcionário</TableHead>
              <TableHead>Departamento</TableHead>
              {!selectedUnitId && <TableHead>Unidade</TableHead>}
              <TableHead className="text-center">Reservas</TableHead>
              <TableHead className="text-center">Retiradas</TableHead>
              <TableHead className="text-center">Não retiradas</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Desconto/Taxa</TableHead>
              <TableHead className="text-right font-semibold">Total a Cobrar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employeeStats.map((s, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell className="text-muted-foreground">{s.department || '—'}</TableCell>
                {!selectedUnitId && <TableCell className="text-muted-foreground">{unidadeMap[s.unidade_id] || '—'}</TableCell>}
                <TableCell className="text-center">{s.total}</TableCell>
                <TableCell className="text-center text-emerald-600">{s.pickedUp}</TableCell>
                <TableCell className="text-center text-destructive">{s.notPickedUp}</TableCell>
                <TableCell className="text-right font-medium">R$ {(s.total * mealPrice).toFixed(2)}</TableCell>
                <TableCell className="text-right text-destructive">
                  {s.notPickedUp > 0 ? `R$ ${(s.notPickedUp * fee).toFixed(2)}` : '—'}
                </TableCell>
                <TableCell className="text-right font-semibold text-primary">
                  R$ {(s.total * mealPrice + s.notPickedUp * fee).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
            {employeeStats.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum dado para este período</TableCell></TableRow>
            )}
            {employeeStats.length > 0 && (
              <TableRow className="bg-muted/30 font-bold">
                <TableCell>Total</TableCell>
                <TableCell />
                {!selectedUnitId && <TableCell />}
                <TableCell className="text-center">{filteredReservations.length}</TableCell>
                <TableCell className="text-center text-emerald-600">{filteredReservations.filter(r => r.status === 'picked_up').length}</TableCell>
                <TableCell className="text-center text-destructive">{filteredReservations.filter(r => r.status === 'not_picked_up').length}</TableCell>
                <TableCell className="text-right text-primary">R$ {grandTotal.toFixed(2)}</TableCell>
                <TableCell className="text-right text-destructive">R$ {grandFee.toFixed(2)}</TableCell>
                <TableCell className="text-right text-primary">R$ {(grandTotal + grandFee).toFixed(2)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}