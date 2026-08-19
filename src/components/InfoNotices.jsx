import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

export default function InfoNotices({ globalSettings }) {
  const reservaInicio = globalSettings?.reserva_inicio || '07:00';
  const reservaFim = globalSettings?.reserva_fim || '09:30';
  const retiradaInicio = globalSettings?.retirada_inicio || '11:45';
  const retiradaFim = globalSettings?.retirada_fim || '13:00';
  const preco = globalSettings?.preco_marmita != null ? `R$ ${Number(globalSettings.preco_marmita).toFixed(2)}` : 'o valor acordado';
  const taxa = globalSettings?.taxa_nao_retirada != null ? `R$ ${Number(globalSettings.taxa_nao_retirada).toFixed(2)}` : 'o valor total';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
      {/* Aviso de horários */}
      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-4">
        <Clock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">Horários do dia</p>
          <p className="text-sm text-blue-700 dark:text-blue-400 leading-relaxed">
            Reservas: <span className="font-semibold">{reservaInicio} às {reservaFim}</span><br />
            Retirada: <span className="font-semibold">{retiradaInicio} às {retiradaFim}</span>
          </p>
        </div>
      </div>

      {/* Aviso de cobrança */}
      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Atenção — Cobrança</p>
          <p className="text-sm text-amber-700 dark:text-amber-400 leading-relaxed">
            Marmita retirada: cobrado <span className="font-semibold">{preco}</span>.<br />
            Reserva sem confirmação de retirada: cobrado <span className="font-semibold">{taxa}</span> (taxa de indisciplina).
          </p>
        </div>
      </div>
    </div>
  );
}