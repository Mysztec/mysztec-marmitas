import React, { useState } from 'react';
import { db } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, UserPlus, Search, Eye, EyeOff, KeyRound, LockOpen } from 'lucide-react';
import { toast } from 'sonner';
import {
  definirPinDoFuncionario,
  redefinirPinDoFuncionario,
  mensagemDeErro,
} from '@/lib/mealActions';
import ResetPinDialog from '@/components/admin/ResetPinDialog';

/** A RPC recusa devolvendo {ok:false}; sem isto a falha passaria despercebida. */
async function gravarPin(employeeId, pin) {
  const r = await definirPinDoFuncionario(employeeId, pin);
  if (!r?.ok) throw new Error(mensagemDeErro(r?.error));
}

/** Mostra em que pe esta a senha, sem nunca revelar o PIN. */
function BadgeSenha({ employee }) {
  const janelaAberta =
    employee.pin_enroll_until && new Date(employee.pin_enroll_until) > new Date();

  if (janelaAberta) {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1">
        <LockOpen className="w-3 h-3" />
        Aguardando cadastro
      </Badge>
    );
  }
  if (!employee.pin_hash) {
    return <Badge variant="outline" className="text-muted-foreground">Não cadastrada</Badge>;
  }
  return <Badge variant="secondary">Cadastrada</Badge>;
}

export default function EmployeeManager({ filterUnitId = null }) {
  const [resetting, setResetting] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', pin: '', department: '', active: true, unidade_id: '' });
  const [showPin, setShowPin] = useState(false);
  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-all'],
    queryFn: () => db.entities.Employee.list(),
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ['unidades'],
    queryFn: () => db.entities.Unidade.list(),
  });

  const createMutation = useMutation({
    mutationFn: async ({ dados, pin }) => {
      const criado = await db.entities.Employee.create(dados);
      if (pin) await gravarPin(criado.id, pin);
      return criado;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-all'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setDialogOpen(false);
      toast.success('Funcionário cadastrado!');
    },
    onError: (erro) => toast.error(erro.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, pin }) => {
      const atualizado = await db.entities.Employee.update(id, data);
      if (pin) await gravarPin(id, pin);
      return atualizado;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-all'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setDialogOpen(false);
      toast.success('Funcionário atualizado!');
    },
    onError: (erro) => toast.error(erro.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.entities.Employee.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-all'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Funcionário removido!');
    },
  });

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', pin: '', department: '', active: true, unidade_id: filterUnitId || '' });
    setShowPin(false);
    setDialogOpen(true);
  };

  const openEdit = (emp) => {
    setEditing(emp);
    // O PIN nunca volta do servidor: o campo fica vazio e so grava se for preenchido.
    setForm({ name: emp.name, pin: '', department: emp.department || '', active: emp.active !== false, unidade_id: emp.unidade_id || '' });
    setShowPin(false);
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (form.pin && form.pin.length !== 4) {
      toast.error('A senha deve ter exatamente 4 dígitos');
      return;
    }
    // O PIN nao trafega junto com o resto: vai por uma funcao do banco que o
    // guarda como hash. A tabela nao tem mais coluna de PIN em texto plano.
    const { pin, ...dados } = form;
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: dados, pin });
    } else {
      createMutation.mutate({ dados, pin });
    }
  };

  const unidadeMap = Object.fromEntries(unidades.map(u => [u.id, u.nome]));

  const filtered = employees
    .filter(e => !filterUnitId || e.unidade_id === filterUnitId)
    .filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-10 rounded-xl" />
        </div>
        <Button onClick={openNew} className="rounded-xl gap-2">
          <UserPlus className="w-4 h-4" /> Novo Funcionário
        </Button>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nome</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Senha</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(emp => (
              <TableRow key={emp.id}>
                <TableCell className="font-medium">{emp.name}</TableCell>
                <TableCell className="text-muted-foreground">{emp.department || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{emp.unidade_id ? (unidadeMap[emp.unidade_id] || '—') : '—'}</TableCell>
                <TableCell>
                  <Badge variant={emp.active !== false ? 'default' : 'secondary'}>
                    {emp.active !== false ? 'Ativo' : 'Inativo'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <BadgeSenha employee={emp} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost" size="icon"
                    title="Redefinir senha"
                    onClick={() => setResetting(emp)}
                  >
                    <KeyRound className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(emp)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(emp.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum funcionário</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ResetPinDialog
        employee={resetting}
        onOpenChange={(aberto) => { if (!aberto) setResetting(null); }}
        onConfirm={async (emp) => {
          const r = await redefinirPinDoFuncionario(emp.id);
          if (!r?.ok) throw new Error(mensagemDeErro(r?.error));
          queryClient.invalidateQueries({ queryKey: ['employees-all'] });
          queryClient.invalidateQueries({ queryKey: ['employees'] });
          return r;
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Funcionário' : 'Novo Funcionário'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do funcionário" />
            </div>
            <div className="space-y-2">
              <Label>Senha (4 dígitos) <span className="text-muted-foreground font-normal">— deixe vazio para manter a atual</span></Label>
              <div className="relative">
                <Input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '') })}
                  placeholder="0000"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPin(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Ex: Produção" />
            </div>
            <div className="space-y-2">
              <Label>Unidade / Barracão</Label>
              <Select value={form.unidade_id || '__none__'} onValueChange={(v) => setForm({ ...form, unidade_id: v === '__none__' ? '' : v })}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecionar unidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem unidade</SelectItem>
                  {unidades.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full rounded-xl" disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? 'Salvar Alterações' : 'Cadastrar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}