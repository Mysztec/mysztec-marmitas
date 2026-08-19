import React, { useState } from 'react';
import { db } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PackageCheck, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { retirarMarmita, mensagemDeErro } from '@/lib/mealActions';
import EmployeeCard from '../components/EmployeeCard';
import PinDialog from '../components/PinDialog';
import PageHeader from '../components/PageHeader';

export default function PickupMeal() {
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

  const reservationMap = {};
  todayReservations.forEach(r => { reservationMap[r.employee_id] = r; });

  const updateReservation = useMutation({
    mutationFn: ({ employeeId, pin }) => retirarMarmita(employeeId, pin),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations', today] });
      setPinOpen(false);
      setSelectedEmployee(null);
      toast.success('Retirada confirmada!');
    },
  });

  // Show only employees who have a reservation today
  const employeesWithReservation = employees.filter(e => reservationMap[e.id]);

  const filtered = employeesWithReservation.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCardClick = (employee) => {
    const reservation = reservationMap[employee.id];
    if (reservation.status === 'picked_up') {
      toast.info('Marmita já foi retirada!');
      return;
    }
    setSelectedEmployee(employee);
    setPinOpen(true);
  };

  // Conferencia do PIN e baixa da reserva acontecem numa transacao no banco.
  const handleConfirmPin = async (pin) => {
    const resultado = await updateReservation.mutateAsync({
      employeeId: selectedEmployee.id,
      pin,
    });
    if (!resultado?.ok) return { error: mensagemDeErro(resultado?.error) };
    return {};
  };

  const getBadge = (employee) => {
    const r = reservationMap[employee.id];
    if (!r) return {};
    if (r.status === 'picked_up') return { badge: '✓ Retirado', badgeColor: 'bg-emerald-100 text-emerald-700' };
    return { badge: 'Aguardando', badgeColor: 'bg-amber-100 text-amber-700' };
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <PageHeader
          icon={PackageCheck}
          title="Retirar Marmita"
          subtitle={format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
        >
          <div className="flex gap-4 text-sm font-medium">
            <span className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700">
              {todayReservations.filter(r => r.status === 'reserved').length} pendente{todayReservations.filter(r => r.status === 'reserved').length !== 1 ? 's' : ''}
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              {todayReservations.filter(r => r.status === 'picked_up').length} retirada{todayReservations.filter(r => r.status === 'picked_up').length !== 1 ? 's' : ''}
            </span>
          </div>
        </PageHeader>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar colaborador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(employee => {
            const { badge, badgeColor } = getBadge(employee);
            return (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                onClick={handleCardClick}
                badge={badge}
                badgeColor={badgeColor}
              />
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <PackageCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma reserva para hoje</p>
          </div>
        )}

        <PinDialog
          open={pinOpen}
          onOpenChange={setPinOpen}
          employeeName={selectedEmployee?.name}
          onConfirm={handleConfirmPin}
          loading={updateReservation.isPending}
          title="Confirmar Retirada"
          description={`${selectedEmployee?.name}, digite sua senha para confirmar a retirada.`}
        />
      </div>
    </div>
  );
}