import React, { useState, useMemo } from 'react';
import { db } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Check, ClipboardList, CalendarDays, Users, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminManualEntry() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reserveTime, setReserveTime] = useState('07:30');
  const [pickupTime, setPickupTime] = useState('12:00');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => db.auth.me(),
  });

  const { data: employees = [], isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees-manual'],
    queryFn: () => db.entities.Employee.filter({ active: true }),
  });

  const { data: existingReservations = [] } = useQuery({
    queryKey: ['reservations-manual', selectedDate],
    queryFn: () => db.entities.MealReservation.filter({ date: selectedDate }),
  });

  const existingEmployeeIds = useMemo(
    () => new Set(existingReservations.map(r => r.employee_id)),
    [existingReservations]
  );

  const filteredEmployees = useMemo(() => {
    return employees
      .filter(e => e.name?.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [employees, search]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const allIds = new Set(filteredEmployees.map(e => e.id));
    setSelectedIds(allIds);
  };

  const clearAll = () => setSelectedIds(new Set());

  const createMutation = useMutation({
    mutationFn: async () => {
      const selected = employees.filter(e => selectedIds.has(e.id));
      const records = selected.map(emp => {
        const [rh, rm] = reserveTime.split(':');
        const [ph, pm] = pickupTime.split(':');
        const reservedAt = new Date(`${selectedDate}T00:00:00`);
        reservedAt.setHours(+rh, +rm, 0, 0);
        const pickedAt = new Date(`${selectedDate}T00:00:00`);
        pickedAt.setHours(+ph, +pm, 0, 0);
        return {
          employee_id: emp.id,
          employee_name: emp.name,
          date: selectedDate,
          status: 'picked_up',
          reserved_at: reservedAt.toISOString(),
          picked_up_at: pickedAt.toISOString(),
          unidade_id: emp.unidade_id || '',
        };
      });
      return db.entities.MealReservation.bulkCreate(records);
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['reservations-manual', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['reservations', selectedDate] });
      setSelectedIds(new Set());
      toast.success(`${created.length} reservas lançadas com sucesso!`);
    },
    onError: () => {
      toast.error('Erro ao lançar reservas. Tente novamente.');
    },
  });

  if (loadingUser) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  // Lancamento manual cria reservas retroativas e por isso e restrito ao dono.
  // A checagem por papel substituiu um e-mail fixo no codigo: identidade nao e
  // autorizacao, e a regra precisava valer tambem no banco (policies de RLS),
  // nao apenas nesta tela.
  if (user?.role !== 'dono') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <Users className="w-8 h-8 text-destructive" />
        </div>
        <p className="text-lg font-semibold text-foreground">Acesso restrito</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Esta tela é exclusiva para o dono do sistema. Contate-o se precisar de acesso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" />
          Lançamento Manual
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione os funcionários e lance solicitação + retirada para uma data específica.
        </p>
      </div>

      {/* Config: date + times */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Data e Horários
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Solicitação</Label>
              <Input
                type="time"
                value={reserveTime}
                onChange={e => setReserveTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Retirada</Label>
              <Input
                type="time"
                value={pickupTime}
                onChange={e => setPickupTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee selection */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Selecionar Funcionários
              {selectedIds.size > 0 && (
                <Badge className="bg-primary text-primary-foreground ml-1">{selectedIds.size}</Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-xl text-xs" onClick={selectAll}>
                Selecionar todos
              </Button>
              <Button variant="ghost" size="sm" className="rounded-xl text-xs" onClick={clearAll} disabled={selectedIds.size === 0}>
                Limpar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar funcionário..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>

          {/* List */}
          {loadingEmployees ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Nenhum funcionário encontrado.</div>
          ) : (
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
              {filteredEmployees.map(emp => {
                const selected = selectedIds.has(emp.id);
                const alreadyHas = existingEmployeeIds.has(emp.id);
                return (
                  <button
                    key={emp.id}
                    onClick={() => toggleSelect(emp.id)}
                    disabled={alreadyHas}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                      alreadyHas
                        ? 'border-border bg-muted/30 opacity-60 cursor-not-allowed'
                        : selected
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-card hover:bg-muted/40'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                      selected ? 'bg-primary border-primary' : 'border-input'
                    }`}>
                      {selected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{emp.name}</p>
                      {alreadyHas && (
                        <p className="text-xs text-amber-600">Já possui reserva nesta data</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Submit */}
          <div className="pt-2 border-t border-border">
            <Button
              className="w-full rounded-xl"
              size="lg"
              disabled={selectedIds.size === 0 || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending
                ? 'Lançando...'
                : `Lançar ${selectedIds.size > 0 ? selectedIds.size : ''} reserva${selectedIds.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}