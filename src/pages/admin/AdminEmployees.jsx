import React from 'react';
import { useOutletContext } from 'react-router-dom';
import EmployeeManager from '../../components/admin/EmployeeManager';

export default function AdminEmployees() {
  const { selectedUnitId } = useOutletContext() || {};
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Funcionários</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Cadastre e gerencie os colaboradores</p>
      </div>
      <EmployeeManager filterUnitId={selectedUnitId} />
    </div>
  );
}