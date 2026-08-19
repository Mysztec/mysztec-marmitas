import React, { useState, useMemo } from 'react';
import { db } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UtensilsCrossed, Search, Clock, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { reservarMarmita, mensagemDeErro } from '@/lib/mealActions';
import EmployeeCard from '../components/EmployeeCard';
import PinDialog from '../components/PinDialog';
import PageHeader from '../components/PageHeader';

export default function ReserveMeal() {
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [pinOpen, setPinOpen] = useState(false);
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => db.entities.Employee.filter({ active: true }),
  });

  const { data: todayReservations = [] } = useQuery({
    queryKey: ['reservations', today],
    queryFn: () => db.entities.MealReservation.filter({ date: today }),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['settings'],
    queryFn: () => db.entities.AppSettings.list(),
  });

  const appSettings = settings[0] || {};
  const reservedIds = new Set(todayReservations.map(r => r.employee_id));

  const isDeadlinePassed = useMemo(() => {
    if (!appSettings.reservation_deadline) return false;
    const [hours, minutes] = appSettings.reservation_deadline.split(':').map(Number);
    const now = new Date();
    const deadline = new Date();
    deadline.setHours(hours, minutes, 0, 0);
    return now > deadline;
  }, [appSettings.reservation_deadline]);

  const createReservation = useMutation({
    mutationFn: ({ employeeId, pin }) => reservarMarmita(employeeId, pin),
    onSuccess: (r) => {
      if (!r?.ok) return;
      queryClient.invalidateQueries({ queryKey: ['reservations', today] });
      setPinOpen(false);
      setSelectedEmployee(null);
      toast.success(r.enrolled
        ? 'Senha cadastrada e marmita reservada!'
        : 'Marmita reservada com sucesso!');
    },
  });

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCardClick = (employee) => {
    if (reservedIds.has(employee.id)) {
      toast.info('Você já reservou sua marmita hoje!');
      return;
    }
    if (isDeadlinePassed) {
      toast.error(`Horário limite para reserva era ${appSettings.reservation_deadline}`);
      return;
    }
    setSelectedEmployee(employee);
    setPinOpen(true);
  };

  // O PIN nao e conferido aqui: quem decide e o banco. O navegador nunca
  // recebe o PIN de ninguem, so o veredito da RPC.
  const handleConfirmPin = async (pin) => {
    const resultado = await createReservation.mutateAsync({
      employeeId: selectedEmployee.id,
      pin,
    });
    if (!resultado?.ok) return { error: mensagemDeErro(resultado?.error) };
    return {};
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          icon={UtensilsCrossed}
          title="Reservar Marmita"
          subtitle={format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
        >
          {appSettings.reservation_deadline && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${isDeadlinePassed ? 'bg-destructive/10 text-destructive' : 'bg-accent text-accent-foreground'}`}>
              {isDeadlinePassed ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              {isDeadlinePassed ? 'Prazo encerrado' : `Até ${appSettings.reservation_deadline}`}
            </div>
          )}
        </PageHeader>

        <div className="mb-6 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar colaborador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl"
            />
          </div>
          <div className="text-sm text-muted-foreground font-medium">
            {todayReservations.length} reserva{todayReservations.length !== 1 ? 's' : ''} hoje
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(employee => (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              onClick={handleCardClick}
              badge={reservedIds.has(employee.id) ? '✓ Reservado' : null}
              badgeColor={reservedIds.has(employee.id) ? 'bg-emerald-100 text-emerald-700' : null}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <UtensilsCrossed className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum colaborador encontrado</p>
          </div>
        )}

        <PinDialog
          open={pinOpen}
          onOpenChange={setPinOpen}
          employeeName={selectedEmployee?.name}
          onConfirm={handleConfirmPin}
          loading={createReservation.isPending}
          title="Reservar Marmita"
          description={`Olá, ${selectedEmployee?.name}! Digite sua senha para reservar.`}
        />
      </div>
    </div>
  );
}