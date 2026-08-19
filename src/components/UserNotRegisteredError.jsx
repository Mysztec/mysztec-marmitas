import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { ShieldAlert, LogOut } from 'lucide-react';

/**
 * A conta existe no provedor de autenticacao mas nao tem perfil na aplicacao.
 * Sem perfil nao ha papel nem unidade, entao nenhuma consulta passaria pelas
 * policies do banco — mostrar a tela vazia seria pior do que explicar.
 */
export default function UserNotRegisteredError() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center shadow-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 mb-6 rounded-2xl bg-amber-500/10">
          <ShieldAlert className="w-7 h-7 text-amber-500" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-3">Acesso nao liberado</h1>
        <p className="text-muted-foreground mb-6">
          Sua conta existe, mas ainda nao foi vinculada a um perfil neste sistema.
          Peca a um administrador para liberar seu acesso.
        </p>

        <div className="text-left text-sm text-muted-foreground bg-muted/50 rounded-xl p-4 mb-6">
          <p className="font-medium text-foreground mb-2">O administrador precisa definir:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>seu papel (dono, admin ou usuario)</li>
            <li>a unidade a qual voce pertence</li>
          </ul>
        </div>

        <Button variant="outline" className="w-full rounded-xl" onClick={logout}>
          <LogOut className="w-4 h-4 mr-2" />
          Sair e entrar com outra conta
        </Button>
      </div>
    </div>
  );
}
