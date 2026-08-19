import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';

const EMPTY = { username: '', password: '', full_name: '', role: 'user', unidade_id: '__none__' };

/** Cadastro de contas de acesso. So admin e dono enxergam este botao. */
export default function NewUserDialog({ unidades = [] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const queryClient = useQueryClient();

  const set = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const createMutation = useMutation({
    mutationFn: () =>
      db.auth.createUser({
        username: form.username,
        password: form.password,
        full_name: form.full_name || null,
        role: form.role,
        unidade_id: form.unidade_id === '__none__' ? null : form.unidade_id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
      toast.success('Usuario criado!');
      setForm(EMPTY);
      setOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const usernameValid = /^[a-z0-9._-]{3,32}$/.test(form.username.trim().toLowerCase());
  const passwordValid = form.password.length >= 8;
  const canSubmit = usernameValid && passwordValid && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-xl">
          <UserPlus className="w-4 h-4 mr-2" />
          Novo usuario
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo usuario</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-username">Usuario</Label>
            <Input
              id="new-username"
              value={form.username}
              onChange={set('username')}
              placeholder="joao.silva"
              autoComplete="off"
            />
            {form.username && !usernameValid && (
              <p className="text-xs text-destructive">
                3 a 32 caracteres: letras minusculas, numeros, ponto, hifen ou underscore.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">Senha</Label>
            <Input
              id="new-password"
              type="password"
              value={form.password}
              onChange={set('password')}
              placeholder="minimo 8 caracteres"
              autoComplete="new-password"
            />
            {form.password && !passwordValid && (
              <p className="text-xs text-destructive">A senha precisa ter ao menos 8 caracteres.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-fullname">Nome completo</Label>
            <Input
              id="new-fullname"
              value={form.full_name}
              onChange={set('full_name')}
              placeholder="Joao da Silva"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select
                value={form.role}
                onValueChange={(role) => setForm((c) => ({ ...c, role }))}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuario</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="dono">Dono</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select
                value={form.unidade_id}
                onValueChange={(unidade_id) => setForm((c) => ({ ...c, unidade_id }))}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem unidade</SelectItem>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Usuario comum enxerga apenas a unidade vinculada. Deixe sem unidade apenas
            para admin ou dono.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            className="rounded-xl"
            disabled={!canSubmit}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? 'Criando...' : 'Criar usuario'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
