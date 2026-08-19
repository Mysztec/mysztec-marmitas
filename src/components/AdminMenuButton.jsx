import React from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Users, Settings, BarChart3, CalendarDays, UserCog, ChevronDown, SlidersHorizontal, Building2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export default function AdminMenuButton() {
  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: () => db.auth.me(),
  });

  if (!user || (user.role !== 'admin' && user.role !== 'dono')) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="rounded-xl gap-2 flex-shrink-0">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Admin
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-xl">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Painel Admin</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/admin" className="flex items-center gap-2 cursor-pointer">
            <Users className="w-4 h-4" /> Funcionários
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/admin/usuarios" className="flex items-center gap-2 cursor-pointer">
            <UserCog className="w-4 h-4" /> Usuários do Sistema
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/admin/unidades" className="flex items-center gap-2 cursor-pointer">
            <Building2 className="w-4 h-4" /> Unidades
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/admin/configuracoes" className="flex items-center gap-2 cursor-pointer">
            <Settings className="w-4 h-4" /> Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/admin/configuracoes-avancadas" className="flex items-center gap-2 cursor-pointer">
            <SlidersHorizontal className="w-4 h-4" /> Config. Avançadas
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/admin/relatorio-diario" className="flex items-center gap-2 cursor-pointer">
            <BarChart3 className="w-4 h-4" /> Relatório Diário
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/admin/relatorio-mensal" className="flex items-center gap-2 cursor-pointer">
            <CalendarDays className="w-4 h-4" /> Relatório Mensal
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}