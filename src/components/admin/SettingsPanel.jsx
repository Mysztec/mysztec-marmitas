import React, { useState, useEffect } from 'react';
import { db } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Save } from 'lucide-react';
import { toast } from 'sonner';
import ThemePicker from './ThemePicker';

export default function SettingsPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ restaurant_phone: '', restaurant_name: '' });

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => db.entities.AppSettings.list(),
  });

  const existing = settings[0];

  useEffect(() => {
    if (existing) {
      setForm({
        restaurant_phone: existing.restaurant_phone || '',
        restaurant_name: existing.restaurant_name || '',
      });
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (existing) return db.entities.AppSettings.update(existing.id, data);
      return db.entities.AppSettings.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Configurações salvas!');
    },
  });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="w-5 h-5 text-primary" /> Restaurante
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do restaurante</Label>
            <Input value={form.restaurant_name} onChange={(e) => setForm({ ...form, restaurant_name: e.target.value })} placeholder="Restaurante XYZ" className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp do restaurante</Label>
            <Input value={form.restaurant_phone} onChange={(e) => setForm({ ...form, restaurant_phone: e.target.value })} placeholder="5511999999999" className="rounded-xl" />
          </div>
        </CardContent>
      </Card>

      <ThemePicker />

      <div className="flex items-end">
        <Button onClick={() => saveMutation.mutate(form)} className="rounded-xl gap-2 h-11 px-8" disabled={saveMutation.isPending}>
          <Save className="w-4 h-4" /> Salvar Configurações
        </Button>
      </div>
    </div>
  );
}