import React from 'react';
import { ShieldOff } from 'lucide-react';

export default function SystemBlockedScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-destructive/10 flex items-center justify-center mb-6">
        <ShieldOff className="w-10 h-10 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Sistema Bloqueado</h1>
      <p className="text-muted-foreground max-w-sm">
        O acesso ao sistema está temporariamente suspenso. Entre em contato com o responsável para regularizar a situação.
      </p>
    </div>
  );
}