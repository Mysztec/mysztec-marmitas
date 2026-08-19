import React, { useState, useMemo } from 'react';
import { db } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Send, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { downloadCsv } from '@/lib/exportCsv';
import { useEndOfDayProcessor } from '@/hooks/useEndOfDayProcessor';

function generateDailyPDF(reservations, appSettings, globalSettings, selectedDate) {
  const dateFormatted = format(new Date(selectedDate + 'T12:00:00'), "dd/MM/yyyy");
  const mealPrice = globalSettings.preco_marmita || 0;
  const feeValue = globalSettings.taxa_nao_retirada || 0;
  const stats = {
    total: reservations.length,
    pickedUp: reservations.filter(r => r.status === 'picked_up').length,
    notPickedUp: reservations.filter(r => r.status === 'not_picked_up').length,
  };
  const totalValue = stats.total * mealPrice;
  const totalFee = stats.notPickedUp * feeValue;
  const statusLabel = { reserved: 'Reservado', picked_up: 'Retirado', not_picked_up: 'Não retirado' };

  const rows = reservations.map(r => `
    <tr>
      <td>${r.employee_name}</td>
      <td>${r.reserved_at ? format(new Date(r.reserved_at), 'HH:mm') : '—'}</td>
      <td>${r.picked_up_at ? format(new Date(r.picked_up_at), 'HH:mm') : '—'}</td>
      <td>${statusLabel[r.status] || r.status}</td>
      <td>R$ ${mealPrice.toFixed(2)}</td>
      <td>${r.status === 'not_picked_up' ? 'R$ ' + feeValue.toFixed(2) : '—'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Relatório Diário - ${dateFormatted}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
    .stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .stat { background: #f5f5f5; border-radius: 10px; padding: 14px 20px; min-width: 120px; }
    .stat-label { font-size: 12px; color: #666; }
    .stat-value { font-size: 24px; font-weight: bold; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f0f0f0; text-align: left; padding: 10px 12px; font-weight: 600; }
    td { padding: 10px 12px; border-bottom: 1px solid #eee; }
  </style>
  </head><body>
  <h1>Relatório Diário de Marmitas</h1>
  <div class="subtitle">${dateFormatted}${appSettings.restaurant_name ? ' · ' + appSettings.restaurant_name : ''}</div>
  <div class="stats">
    <div class="stat"><div class="stat-label">Total</div><div class="stat-value">${stats.total}</div></div>
    <div class="stat"><div class="stat-label">Retiradas</div><div class="stat-value" style="color:#16a34a">${stats.pickedUp}</div></div>
    <div class="stat"><div class="stat-label">Não retiradas</div><div class="stat-value" style="color:#dc2626">${stats.notPickedUp}</div></div>
    <div class="stat"><div class="stat-label">Valor total</div><div class="stat-value" style="color:#ea7c34">R$ ${totalValue.toFixed(2)}</div></div>
    ${totalFee > 0 ? `<div class="stat"><div class="stat-label">Total taxas</div><div class="stat-value" style="color:#dc2626">R$ ${totalFee.toFixed(2)}</div></div>` : ''}
  </div>
  <table>
    <thead><tr><th>Funcionário</th><th>Reserva</th><th>Retirada</th><th>Status</th><th>Valor</th><th>Taxa</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  </body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) win.addEventListener('load', () => win.print());
}

const STATUS_LABELS = {
  reserved: { label: 'Reservado', color: 'bg-amber-100 text-amber-700' },
  picked_up: { label: 'Retirado', color: 'bg-emerald-100 text-emerald-700' },
  not_picked_up: { label: 'Não retirado', color: 'bg-red-100 text-red-700' },
};

export default function DailyReport() {
  useEndOfDayProcessor();

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterEmployee, setFilterEmployee] = useState('__all__');
  const [filterStatus, setFilterStatus] = useState('__all__');
  const { selectedUnitId } = useOutletContext() || {};

  const { data: allReservations = [] } = useQuery({
    queryKey: ['reservations-report', selectedDate],
    queryFn: () => db.entities.MealReservation.filter({ date: selectedDate }),
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
  const feeValue = globalSettings.taxa_nao_retirada || 0;

  // Filtragem
  const scopedReservations = useMemo(() =>
    selectedUnitId ? allReservations.filter(r => r.unidade_id === selectedUnitId) : allReservations,
    [allReservations, selectedUnitId]
  );

  const employeeOptions = useMemo(() => {
    const names = [...new Set(scopedReservations.map(r => r.employee_name))].sort();
    return names;
  }, [scopedReservations]);

  const filtered = useMemo(() => scopedReservations
    .filter(r => filterEmployee === '__all__' || r.employee_name === filterEmployee)
    .filter(r => filterStatus === '__all__' || r.status === filterStatus)
    .sort((a, b) => a.employee_name.localeCompare(b.employee_name, 'pt-BR')),
    [scopedReservations, filterEmployee, filterStatus]
  );

  const stats = useMemo(() => ({
    total: scopedReservations.length,
    pickedUp: scopedReservations.filter(r => r.status === 'picked_up').length,
    notPickedUp: scopedReservations.filter(r => r.status === 'not_picked_up').length,
    pending: scopedReservations.filter(r => r.status === 'reserved').length,
  }), [scopedReservations]);

  const totalValue = stats.total * mealPrice;
  const totalFee = stats.notPickedUp * feeValue;

  const exportCsv = () => {
    const hasFees = stats.notPickedUp > 0;
    const header = ['Funcionário', 'Hora Reserva', 'Hora Retirada', 'Status', 'Valor Marmita (R$)',
      ...(hasFees ? ['Desconto Indisciplina/Taxa (R$)'] : [])];
    const rows = filtered.map(r => [
      r.employee_name,
      r.reserved_at ? format(new Date(r.reserved_at), 'HH:mm') : '',
      r.picked_up_at ? format(new Date(r.picked_up_at), 'HH:mm') : '',
      STATUS_LABELS[r.status]?.label || r.status,
      mealPrice.toFixed(2),
      ...(hasFees ? [r.status === 'not_picked_up' ? feeValue.toFixed(2) : '0.00'] : []),
    ]);
    downloadCsv([header, ...rows], `marmitas-${selectedDate}.csv`);
  };

  const sendToRestaurant = () => {
    const phone = appSettings.restaurant_phone;
    if (!phone) { toast.error('Configure o WhatsApp do restaurante nas configurações'); return; }
    const dateFormatted = format(new Date(selectedDate + 'T12:00:00'), "dd/MM/yyyy");

    // Agrupar por unidade, independente do filtro ativo
    let unitLines = '';
    if (unidades.length > 0) {
      const unidadeMap = Object.fromEntries(unidades.map(u => [u.id, u.nome]));
      const byUnit = {};
      allReservations.forEach(r => {
        const key = r.unidade_id || '__sem__';
        byUnit[key] = (byUnit[key] || 0) + 1;
      });
      unitLines = Object.entries(byUnit)
        .map(([uid, count]) => `  • ${unidadeMap[uid] || 'Sem unidade'}: ${count} marmita${count !== 1 ? 's' : ''}`)
        .join('\n');
    }

    const totalGeral = allReservations.length;
    const message = `🍽️ Pedido de Marmitas - ${dateFormatted}\n\nTotal: ${totalGeral} marmita${totalGeral !== 1 ? 's' : ''}${unitLines ? '\n\nPor unidade:\n' + unitLines : ''}\n\nObrigado!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Data</Label>
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-44 rounded-xl" />
        </div>
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
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="reserved">Reservado</SelectItem>
              <SelectItem value="picked_up">Retirado</SelectItem>
              <SelectItem value="not_picked_up">Não retirado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2 ml-auto">
          <Button onClick={sendToRestaurant} className="rounded-xl gap-2" variant="outline">
            <Send className="w-4 h-4" /> WhatsApp
          </Button>
          <Button onClick={() => generateDailyPDF(filtered, appSettings, globalSettings, selectedDate)} className="rounded-xl gap-2" variant="outline" disabled={filtered.length === 0}>
            <FileDown className="w-4 h-4" /> PDF
          </Button>
          <Button onClick={exportCsv} className="rounded-xl gap-2" variant="outline" disabled={filtered.length === 0}>
            <FileDown className="w-4 h-4" /> CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl"><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-3xl font-bold mt-1">{stats.total}</p>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Retiradas</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{stats.pickedUp}</p>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Não retiradas</p>
          <p className="text-3xl font-bold text-destructive mt-1">{stats.notPickedUp}</p>
        </CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="p-5">
          <p className="text-sm text-muted-foreground">Valor total</p>
          <p className="text-3xl font-bold text-primary mt-1">R$ {totalValue.toFixed(2)}</p>
          {totalFee > 0 && <p className="text-xs text-destructive mt-1">+ R$ {totalFee.toFixed(2)} taxas</p>}
        </CardContent></Card>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Funcionário</TableHead>
              <TableHead>Reserva</TableHead>
              <TableHead>Retirada</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Taxa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(r => {
              const st = STATUS_LABELS[r.status] || STATUS_LABELS.reserved;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.employee_name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.reserved_at ? format(new Date(r.reserved_at), 'HH:mm') : '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{r.picked_up_at ? format(new Date(r.picked_up_at), 'HH:mm') : '—'}</TableCell>
                  <TableCell><Badge className={st.color}>{st.label}</Badge></TableCell>
                  <TableCell className="text-right font-medium">R$ {mealPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-destructive">
                    {r.status === 'not_picked_up' ? `R$ ${feeValue.toFixed(2)}` : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma reserva encontrada</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}