import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { KeyRound, Clock } from 'lucide-react';
import { toast } from 'sonner';

const horario = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Confirmacao da redefinicao de senha.
 *
 * Deixa explicito o que vai acontecer: o administrador nao escolhe senha
 * nenhuma, apenas apaga a atual e libera o funcionario a cadastrar a nova no
 * totem dentro de 30 minutos.
 */
export default function ResetPinDialog({ employee, onOpenChange, onConfirm }) {
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    setEnviando(true);
    try {
      const r = await onConfirm(employee);
      toast.success(
        r?.enroll_until
          ? `Senha apagada. ${employee.name} pode cadastrar a nova até ${horario(r.enroll_until)}.`
          : 'Senha apagada.'
      );
      onOpenChange(false);
    } catch (erro) {
      toast.error(erro.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AlertDialog open={!!employee} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Redefinir senha de {employee?.name}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                A senha atual será apagada. Você <strong>não</strong> define uma nova —
                quem cadastra é o próprio funcionário, na estação de refeição.
              </p>
              <div className="flex gap-2 items-start bg-muted/50 rounded-lg p-3">
                <Clock className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                <span>
                  Ele terá <strong>30 minutos</strong> para digitar a senha nova. Nesse
                  intervalo, a primeira senha digitada naquele nome passa a valer —
                  então avise a pessoa antes de confirmar.
                </span>
              </div>
              <p className="text-muted-foreground">
                A redefinição fica registrada com seu usuário e horário.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); confirmar(); }}
            disabled={enviando}
          >
            {enviando ? 'Redefinindo...' : 'Redefinir senha'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
