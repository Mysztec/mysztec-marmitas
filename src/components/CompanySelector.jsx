import React from 'react';
import { db } from '@/api/client';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/lib/CompanyContext';
import { Building2, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

// Used only in the admin area for you to switch between companies
export default function CompanySelector() {
  const { selectedCompany, selectCompany } = useCompany();

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => db.entities.Company.filter({ active: true }),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl gap-2 max-w-[220px]">
          <Building2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="truncate text-sm">{selectedCompany?.name || 'Selecionar empresa'}</span>
          <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-xl">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Trocar empresa</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {companies.map(c => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => selectCompany(c)}
            className={selectedCompany?.id === c.id ? 'bg-accent font-semibold' : ''}
          >
            <Building2 className="w-4 h-4 mr-2" />
            {c.name}
          </DropdownMenuItem>
        ))}
        {companies.length === 0 && (
          <DropdownMenuItem disabled>Nenhuma empresa cadastrada</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}