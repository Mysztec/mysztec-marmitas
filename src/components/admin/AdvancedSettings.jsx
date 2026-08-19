import React, { useState, useEffect } from 'react';
import { db } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Clock, DollarSign, ShieldAlert, Save, AlertTriangle, Ban, Unlock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

const TIME_FIELD = ({ label, value, onChange }) => {
  const [h, m] = (value || '').split(':');
  const hour = h || '00';
  const minute = m || '00';

  const handleChange = (type, val) => {
    if (type === 'h') onChange(`${val}:${minute}`);
    else onChange(`${hour}:${val}`);
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-1 items-center">
        <Select value={hour} onValueChange={(v) => handleChange('h', v)}>
          <SelectTrigger className="rounded-xl flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map(h => <SelectItem key={h} value={h}>{h}h</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground font-bold">:</span>
        <Select value={minute} onValueChange={(v) => handleChange('m', v)}>
          <SelectTrigger className="rounded-xl w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MINUTES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default function AdvancedSettings() {
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => db.auth.me(),
  });

  const isDono = currentUser?.role === 'dono';

  const { data = [] } = useQuery({
    queryKey: ['global-settings'],
    queryFn: () => db.entities.GlobalSettings.list(),
  });

  const existing = data[0];

  const [form, setForm] = useState({
    reserva_inicio: '',
    reserva_fim: '',
    retirada_inicio: '',
    retirada_fim: '',
    preco_marmita: '',
    taxa_nao_retirada: '',
    trava_manual: false,
    sistema_bloqueado: false,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        reserva_inicio: existing.reserva_inicio || '',
        reserva_fim: existing.reserva_fim || '',
        retirada_inicio: existing.retirada_inicio || '',
        retirada_fim: existing.retirada_fim || '',
        preco_marmita: existing.preco_marmita ?? '',
        taxa_nao_retirada: existing.taxa_nao_retirada ?? '',
        trava_manual: existing.trava_manual || false,
        sistema_bloqueado: existing.sistema_bloqueado || false,
      });
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (existing) return db.entities.GlobalSettings.update(existing.id, data);
      return db.entities.GlobalSettings.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-settings'] });
      toast.success('Configurações globais salvas!');
    },
  });

  // Bloqueio geral do sistema (só dono)
  const toggleSystemBlockMutation = useMutation({
    mutationFn: (blocked) => {
      if (existing) return db.entities.GlobalSettings.update(existing.id, { sistema_bloqueado: blocked });
      return db.entities.GlobalSettings.create({ sistema_bloqueado: blocked });
    },
    onSuccess: (_, blocked) => {
      queryClient.invalidateQueries({ queryKey: ['global-settings'] });
      setForm(f => ({ ...f, sistema_bloqueado: blocked }));
      toast[blocked ? 'error' : 'success'](blocked ? 'Sistema bloqueado por inadimplência!' : 'Sistema desbloqueado com sucesso!');
    },
  });

  // Trava rápida sem precisar salvar o formulário inteiro
  const toggleLockMutation = useMutation({
    mutationFn: (locked) => {
      if (existing) return db.entities.GlobalSettings.update(existing.id, { trava_manual: locked });
      return db.entities.GlobalSettings.create({ trava_manual: locked });
    },
    onSuccess: (_, locked) => {
      queryClient.invalidateQueries({ queryKey: ['global-settings'] });
      setForm(f => ({ ...f, trava_manual: locked }));
      toast[locked ? 'warning' : 'success'](locked ? 'Sistema bloqueado manualmente!' : 'Sistema desbloqueado!');
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      ...form,
      preco_marmita: form.preco_marmita !== '' ? Number(form.preco_marmita) : null,
      taxa_nao_retirada: form.taxa_nao_retirada !== '' ? Number(form.taxa_nao_retirada) : null,
    });
  };

  const set = (key) => (value) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="space-y-6">
      {/* Bloqueio geral do sistema — só para o dono */}
      {isDono && (
        <Card className={`rounded-2xl border-2 ${form.sistema_bloqueado ? 'border-destructive bg-destructive/5' : 'border-border'}`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Ban className={`w-5 h-5 ${form.sistema_bloqueado ? 'text-destructive' : 'text-muted-foreground'}`} />
              Bloqueio Geral do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use este bloqueio em caso de inadimplência. Todos os usuários verão uma tela de sistema bloqueado. Apenas você (dono) continuará com acesso normal.
            </p>
            <div className="flex gap-3">
              <Button
                variant={form.sistema_bloqueado ? 'outline' : 'destructive'}
                className="rounded-xl gap-2"
                onClick={() => toggleSystemBlockMutation.mutate(!form.sistema_bloqueado)}
                disabled={toggleSystemBlockMutation.isPending}
              >
                {form.sistema_bloqueado ? (
                  <><Unlock className="w-4 h-4" /> Desbloquear Sistema</>
                ) : (
                  <><Ban className="w-4 h-4" /> Bloquear Sistema</>
                )}
              </Button>
            </div>
            {form.sistema_bloqueado && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Sistema bloqueado — todos os usuários estão sem acesso.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Trava manual — destaque no topo */}
      <Card className={`rounded-2xl border-2 ${form.trava_manual ? 'border-destructive bg-destructive/5' : 'border-border'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className={`w-5 h-5 ${form.trava_manual ? 'text-destructive' : 'text-primary'}`} />
            Trava Manual do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/50">
            <div>
              <p className="font-medium text-sm">
                {form.trava_manual ? '🔴 Sistema bloqueado' : '🟢 Sistema em operação normal'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ativar bloqueia imediatamente reservas e retiradas para todos os funcionários.
              </p>
            </div>
            <Switch
              checked={form.trava_manual}
              onCheckedChange={(val) => toggleLockMutation.mutate(val)}
              disabled={toggleLockMutation.isPending}
            />
          </div>
          {form.trava_manual && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              O sistema está bloqueado. Funcionários não conseguem fazer reservas ou retiradas.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Horários */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-5 h-5 text-primary" /> Horários de Reserva
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <TIME_FIELD label="Início" value={form.reserva_inicio} onChange={set('reserva_inicio')} />
            <TIME_FIELD label="Fim" value={form.reserva_fim} onChange={set('reserva_fim')} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="w-5 h-5 text-emerald-600" /> Horários de Retirada
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <TIME_FIELD label="Início" value={form.retirada_inicio} onChange={set('retirada_inicio')} />
            <TIME_FIELD label="Fim" value={form.retirada_fim} onChange={set('retirada_fim')} />
          </CardContent>
        </Card>
      </div>

      {/* Financeiro */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="w-5 h-5 text-primary" /> Valores Financeiros
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Preço da marmita</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
              <Input
                type="text"
                inputMode="decimal"
                value={form.preco_marmita}
                onChange={(e) => {
                  const v = e.target.value.replace(',', '.');
                  if (/^\d*\.?\d*$/.test(v)) setForm(f => ({ ...f, preco_marmita: v }));
                }}
                placeholder="0,00"
                className="rounded-xl pl-10"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Taxa por não retirada</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
              <Input
                type="text"
                inputMode="decimal"
                value={form.taxa_nao_retirada}
                onChange={(e) => {
                  const v = e.target.value.replace(',', '.');
                  if (/^\d*\.?\d*$/.test(v)) setForm(f => ({ ...f, taxa_nao_retirada: v }));
                }}
                placeholder="0,00"
                className="rounded-xl pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saveMutation.isPending} className="rounded-xl gap-2 h-11 px-8">
        <Save className="w-4 h-4" /> Salvar Configurações Globais
      </Button>
    </div>
  );
}