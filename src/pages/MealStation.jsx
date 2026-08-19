import React, { useState, useEffect } from 'react';
import { db } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UtensilsCrossed, PackageCheck, Search, Hourglass, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { reservarMarmita, retirarMarmita, mensagemDeErro } from '@/lib/mealActions';
import EmployeeCard from '../components/EmployeeCard';
import PinDialog from '../components/PinDialog';
import AdminMenuButton from '../components/AdminMenuButton';
import SystemStepper from '../components/SystemStepper';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { useUnitScope } from '@/hooks/useUnitScope';
import InfoNotices from '../components/InfoNotices';
import SystemBlockedScreen from '../components/SystemBlockedScreen';

export default function MealStation() {
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [activeAction, setActiveAction] = useState(null);
  const [pinOpen, setPinOpen] = useState(false);
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { isReserveOpen, isPickupOpen, phase, settings: globalSettings } = useGlobalSettings();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => db.auth.me(),
  });

  const isDono = currentUser?.role === 'dono';

  const { filterByUnit } = useUnitScope();

  const { data: allEmployees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => db.entities.Employee.filter({ active: true }),
    refetchInterval: 30_000,
  });

  const employees = filterByUnit(allEmployees).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const { data: todayReservations = [] } = useQuery({
    queryKey: ['reservations', today],
    queryFn: () => db.entities.MealReservation.filter({ date: today }),
    refetchInterval: 10_000,
  });

  // Atualização em tempo real via subscription
  useEffect(() => {
    const unsubReservations = db.entities.MealReservation.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['reservations', today] });
    });
    const unsubEmployees = db.entities.Employee.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    });
    return () => {
      unsubReservations();
      unsubEmployees();
    };
  }, [today]);

  const reservedIds = new Set(todayReservations.map(r => r.employee_id));
  const reservationMap = {};
  todayReservations.forEach(r => { reservationMap[r.employee_id] = r; });

  // Mode: reserve window open → reserve; pickup window open → pickup
  const isReserveMode = phase === 'reserve';

  const finalizar = (mensagem) => {
    queryClient.invalidateQueries({ queryKey: ['reservations', today] });
    setPinOpen(false);
    setSelectedEmployee(null);
    setSearch('');
    toast.success(mensagem);
  };

  const createReservation = useMutation({
    mutationFn: ({ employeeId, pin }) => reservarMarmita(employeeId, pin),
    onSuccess: (r) => { if (r?.ok) finalizar('Marmita reservada com sucesso!'); },
  });

  const updateReservation = useMutation({
    mutationFn: ({ employeeId, pin }) => retirarMarmita(employeeId, pin),
    onSuccess: (r) => { if (r?.ok) finalizar('Retirada confirmada!'); },
  });

  const handleReserveClick = (employee) => {
    if (!isReserveOpen) { toast.error('Período de reservas encerrado.'); return; }
    if (reservedIds.has(employee.id)) { toast.info('Você já reservou sua marmita hoje!'); return; }
    setSelectedEmployee(employee);
    setActiveAction('reserve');
    setPinOpen(true);
  };

  const handlePickupClick = (employee) => {
    if (!isPickupOpen) { toast.error('Período de retirada encerrado.'); return; }
    const reservation = reservationMap[employee.id];
    if (reservation.status === 'picked_up') { toast.info('Marmita já foi retirada!'); return; }
    setSelectedEmployee(employee);
    setActiveAction('pickup');
    setPinOpen(true);
  };

  // Toda a decisao (PIN, janela de horario, unidade, bloqueio do sistema)
  // acontece no banco. O navegador so mostra o veredito.
  const handleConfirmPin = async (pin) => {
    const mutation = activeAction === 'reserve' ? createReservation : updateReservation;
    const resultado = await mutation.mutateAsync({ employeeId: selectedEmployee.id, pin });
    if (!resultado?.ok) return { error: mensagemDeErro(resultado?.error) };
    return {};
  };

  const sistemaBloqueado = globalSettings?.sistema_bloqueado && !isDono;

  const dateLabel = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  // Reserve mode: only employees who haven't reserved yet
  const reserveEmployees = employees
    .filter(e => !reservedIds.has(e.id))
    .filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  // Pickup mode: only employees who have a reservation
  const pickupEmployees = employees
    .filter(e => reservationMap[e.id])
    .filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  const visibleEmployees = isReserveMode ? reserveEmployees : pickupEmployees;

  const pageTitle = {
    reserve: 'Reservar Marmita',
    waiting: 'Sistema em Espera',
    pickup:  'Retirar Marmita',
    done:    'Sistema de Marmitas',
    locked:  'Sistema de Marmitas',
  }[phase] || 'Sistema de Marmitas';

  if (sistemaBloqueado) return <SystemBlockedScreen />;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
            <p className="text-muted-foreground text-sm mt-0.5 capitalize">{dateLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <AdminMenuButton />
            <button
              onClick={() => db.auth.logout()}
              className="w-8 h-8 rounded-full opacity-10 hover:opacity-40 transition-opacity duration-300 flex items-center justify-center text-muted-foreground"
              title="Sair"
            >
              <span className="text-xs select-none">⏻</span>
            </button>
          </div>
        </div>

        {/* Stepper */}
        <SystemStepper
          phase={phase}
          settings={globalSettings}
          reservedCount={reservedIds.size}
          pickedUpCount={todayReservations.filter(r => r.status === 'picked_up').length}
          totalReserved={todayReservations.length}
        />

        {/* Locked state */}
        {phase === 'locked' && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <Lock className="w-8 h-8 text-destructive" />
            </div>
            <p className="text-lg font-semibold text-foreground">Sistema temporariamente bloqueado</p>
            <p className="text-sm text-muted-foreground max-w-xs">O administrador bloqueou o sistema. Tente novamente mais tarde.</p>
          </div>
        )}

        {/* Waiting state */}
        {phase === 'waiting' && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center">
              <Hourglass className="w-8 h-8 text-amber-500" />
            </div>
            <p className="text-lg font-semibold text-foreground">Sistema em espera</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Pedidos enviados ao restaurante. A retirada começa às {globalSettings.retirada_inicio}.
            </p>
            <div className="mt-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700 font-medium">
              {reservedIds.size} marmita{reservedIds.size !== 1 ? 's' : ''} reservada{reservedIds.size !== 1 ? 's' : ''} hoje
            </div>
          </div>
        )}

        {/* Info notices */}
        <InfoNotices globalSettings={globalSettings} />

        {/* Search + Cards (only during active phases) */}
        {(phase === 'reserve' || phase === 'pickup') && <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar colaborador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl"
          />
        </div>}

        {(phase === 'reserve' || phase === 'pickup') && (
          visibleEmployees.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {visibleEmployees.map(employee => {
                if (isReserveMode) {
                  return (
                    <EmployeeCard
                      key={employee.id}
                      employee={employee}
                      onClick={handleReserveClick}
                    />
                  );
                } else {
                  const r = reservationMap[employee.id];
                  const badge = r?.status === 'picked_up' ? '✓ Retirado' : 'Aguardando';
                  const badgeColor = r?.status === 'picked_up' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
                  return (
                    <EmployeeCard key={employee.id} employee={employee} onClick={handlePickupClick} badge={badge} badgeColor={badgeColor} />
                  );
                }
              })}
            </div>
          ) : (
            <div className="text-center py-20 text-muted-foreground">
              {isReserveMode ? (
                <>
                  <UtensilsCrossed className="w-14 h-14 mx-auto mb-3 opacity-20" />
                  <p className="font-semibold text-base">Todos os colaboradores já reservaram!</p>
                  <p className="text-sm mt-1">{reservedIds.size} reserva{reservedIds.size !== 1 ? 's' : ''} confirmada{reservedIds.size !== 1 ? 's' : ''} hoje</p>
                </>
              ) : (
                <>
                  <PackageCheck className="w-14 h-14 mx-auto mb-3 opacity-20" />
                  <p className="font-semibold text-base">Nenhuma reserva para hoje</p>
                </>
              )}
            </div>
          )
        )}

        <PinDialog
          open={pinOpen}
          onOpenChange={setPinOpen}
          employeeName={selectedEmployee?.name}
          onConfirm={handleConfirmPin}
          loading={createReservation.isPending || updateReservation.isPending}
          title={activeAction === 'reserve' ? 'Reservar Marmita' : 'Confirmar Retirada'}
          description={
            selectedEmployee && !selectedEmployee.pin
              ? `Olá, ${selectedEmployee?.name}! Você ainda não tem senha. Digite uma senha de 4 dígitos para cadastrar.`
              : activeAction === 'reserve'
              ? `Olá, ${selectedEmployee?.name}! Digite sua senha para reservar.`
              : `${selectedEmployee?.name}, digite sua senha para confirmar a retirada.`
          }
        />
      </div>
    </div>
  );
}