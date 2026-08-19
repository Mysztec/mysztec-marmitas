import React from 'react';
import { db } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserCog, ShieldCheck, User, Crown } from 'lucide-react';
import { toast } from 'sonner';
import NewUserDialog from '@/components/admin/NewUserDialog';

export default function AdminUsers() {
  const queryClient = useQueryClient();

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['system-users'],
    queryFn: () => db.entities.User.list('-created_date', 100),
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ['unidades'],
    queryFn: () => db.entities.Unidade.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => db.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-users'] });
      toast.success('Usuário atualizado!');
    },
  });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários do Sistema</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Defina papel e unidade de cada usuário</p>
        </div>
        <NewUserDialog unidades={unidades} />
      </div>

      <div className="bg-accent/50 border border-border rounded-xl p-4 mb-6 flex gap-3">
        <ShieldCheck className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-foreground mb-1">Controle de acesso</p>
          <p className="text-muted-foreground"><strong>Dono:</strong> acesso total, incluindo bloqueio geral do sistema por inadimplência.</p>
          <p className="text-muted-foreground"><strong>Admin:</strong> acessa o painel completo, pode ver todas as unidades ou filtrar.</p>
          <p className="text-muted-foreground"><strong>Usuário:</strong> vê apenas dados da unidade vinculada ao seu perfil.</p>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Nome</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Alterar Papel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {error && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-destructive">Erro: {error.message}</TableCell></TableRow>
            )}
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {u.role === 'dono' ? <Crown className="w-4 h-4 text-amber-500" /> : u.role === 'admin' ? <ShieldCheck className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-muted-foreground" />}
                    {u.full_name || '—'}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-xs">{u.username}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Badge variant={u.role === 'dono' ? 'default' : u.role === 'admin' ? 'default' : 'secondary'} className={u.role === 'dono' ? 'bg-amber-500 text-white' : ''}>
                    {u.role === 'dono' ? 'Dono' : u.role === 'admin' ? 'Admin' : 'Usuário'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Select
                    value={u.unidade_id || '__none__'}
                    onValueChange={(val) => updateMutation.mutate({ id: u.id, data: { unidade_id: val === '__none__' ? null : val } })}
                  >
                    <SelectTrigger className="w-40 h-8 rounded-lg text-xs">
                      <SelectValue placeholder="Sem unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem unidade</SelectItem>
                      {unidades.map(un => (
                        <SelectItem key={un.id} value={un.id}>{un.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={u.role || 'user'}
                    onValueChange={(role) => updateMutation.mutate({ id: u.id, data: { role } })}
                  >
                    <SelectTrigger className="w-36 h-9 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dono">Dono</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">Usuário</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && users.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}