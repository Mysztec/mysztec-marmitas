import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { db } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { useUnitScope } from '@/hooks/useUnitScope';
import { UtensilsCrossed, Users, Settings, BarChart3, CalendarDays, UserCog, LogOut, Menu, X, ChevronRight, SlidersHorizontal, Building2, ChevronLeft, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const navItems = [
  { to: '/marmitas', icon: UtensilsCrossed, label: 'Reserva & Retirada' },
  { to: '/admin', icon: Users, label: 'Funcionários' },
  { to: '/admin/unidades', icon: Building2, label: 'Unidades' },
  { to: '/admin/usuarios', icon: UserCog, label: 'Usuários do Sistema' },
  { to: '/admin/configuracoes', icon: Settings, label: 'Configurações' },
  { to: '/admin/configuracoes-avancadas', icon: SlidersHorizontal, label: 'Config. Avançadas' },
  { to: '/admin/relatorio-diario', icon: BarChart3, label: 'Relatório Diário' },
  { to: '/admin/relatorio-mensal', icon: CalendarDays, label: 'Relatório Mensal' },
  { to: '/admin/lancamento-manual', icon: ClipboardList, label: 'Lançamento Manual' },
];

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { isAdmin, unidades, selectedUnitId, setSelectedUnitId } = useUnitScope();

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => db.auth.me(),
  });



  if (!loadingUser && user && user.role !== 'admin' && user.role !== 'dono') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Acesso restrito</p>
          <p className="text-sm text-muted-foreground mt-1">Você não tem permissão para acessar esta área.</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => db.auth.logout('/login');

  return (
    <div className="flex min-h-screen bg-background">
      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside className={`fixed top-0 left-0 h-full z-30 w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:flex`}>
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Marmita Express</p>
            <p className="text-xs text-muted-foreground">Admin</p>
          </div>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={() => setOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
                {active && <ChevronRight className="w-3 h-3 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          {user && (
            <div className="px-3 py-2 mb-2">
              <p className="text-sm font-medium truncate">{user.full_name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all w-full"
          >
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-sm">Marmita Express</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {isAdmin && unidades.length > 0 && (
              <Select
                value={selectedUnitId || '__all__'}
                onValueChange={(v) => setSelectedUnitId(v === '__all__' ? null : v)}
              >
                <SelectTrigger className="w-48 h-9 rounded-xl text-sm">
                  <Building2 className="w-4 h-4 text-muted-foreground mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as unidades</SelectItem>
                  {unidades.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto pb-24 lg:pb-8">
          <Outlet context={{ selectedUnitId, isAdmin }} />
        </main>
      </div>

      {/* Bottom Nav — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border flex lg:hidden safe-bottom">
        {[
          { to: '/marmitas', icon: UtensilsCrossed, label: 'Reservas' },
          { to: '/admin', icon: Users, label: 'Funcionários' },
          { to: '/admin/relatorio-diario', icon: BarChart3, label: 'Diário' },
          { to: '/admin/relatorio-mensal', icon: CalendarDays, label: 'Mensal' },
          { to: '/admin/configuracoes-avancadas', icon: Settings, label: 'Config' },
        ].map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-medium transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}