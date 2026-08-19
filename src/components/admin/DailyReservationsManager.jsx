import React, { useState } from 'react';
import { db } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, X, UtensilsCrossed, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function DailyReservationsManager() {
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [search, setSearch] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['reservations-admin', today],
    queryFn: () => db.entities.MealReservation.filter({ date: today }),
    refetchInterval: 10_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => db.entities.MealReservation.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations-admin', today] });
      queryClient.invalidateQueries({ queryKey: ['reservations', today] });
      toast.success('Reserva cancelada com sucesso.');
      setCancelTarget(null);
    },
  });

  const filtered = reservations.filter(r =>
    r.employee_name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusConfig = {
    reserved: { label: 'Reservado', color: 'bg-amber-100 text-amber-700', icon: Clock },
    picked_up: { label: 'Retirado', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    not_picked_up: { label: 'Não retirado', color: 'bg-red-100 text-red-700', icon: XCircle },
  };

  const total = reservations.length;
  const retirados = reservations.filter(r => r.status === 'picked_up').length;
  const pendentes = reservations.filter(r => r.status === 'reserved').length;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UtensilsCrossed className="w-5 h-5 text-primary" />
          Reservas de Hoje
          <span className="ml-auto text-sm font-normal text-muted-foreground capitalize">
            {format(new Date(), "d 'de' MMMM", { locale: ptBR })}
          </span>
        </CardTitle>
        {/* Resumo */}
        <div className="flex gap-3 text-sm pt-1">
          <span className="px-2.5 py-1 rounded-lg bg-muted font-medium">{total} total</span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 font-medium">{retirados} retirados</span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 font-medium">{pendentes} pendentes</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar colaborador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma reserva encontrada.</div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {filtered.map(r => {
              const cfg = statusConfig[r.status] || statusConfig.reserved;
              const Icon = cfg.icon;
              return (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-primary">
                      {r.employee_name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.employee_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.reserved_at ? format(new Date(r.reserved_at), 'HH:mm') : '--'}
                    </p>
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg ${cfg.color}`}>
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                  {r.status === 'reserved' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg flex-shrink-0"
                      onClick={() => setCancelTarget(r)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar a reserva de <strong>{cancelTarget?.employee_name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive hover:bg-destructive/90"
              onClick={() => cancelMutation.mutate(cancelTarget.id)}
              disabled={cancelMutation.isPending}
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}