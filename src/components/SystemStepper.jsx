import React, { useEffect, useState } from 'react';
import { UtensilsCrossed, Hourglass, PackageCheck, Lock, CheckCircle2 } from 'lucide-react';

const PHASES = [
  { key: 'reserve',  label: 'Reservas',  icon: UtensilsCrossed },
  { key: 'waiting',  label: 'Em espera', icon: Hourglass },
  { key: 'pickup',   label: 'Retirada',  icon: PackageCheck },
  { key: 'done',     label: 'Encerrado', icon: CheckCircle2 },
];

const PHASE_STYLES = {
  reserve: { active: 'bg-primary text-primary-foreground', dot: 'bg-primary', bar: 'bg-primary/20 border-primary/30', text: 'text-primary' },
  waiting: { active: 'bg-amber-500 text-white',           dot: 'bg-amber-500', bar: 'bg-amber-50 border-amber-200', text: 'text-amber-600' },
  pickup:  { active: 'bg-emerald-500 text-white',         dot: 'bg-emerald-500', bar: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-600' },
  done:    { active: 'bg-muted-foreground text-white',    dot: 'bg-muted-foreground', bar: 'bg-muted border-border', text: 'text-muted-foreground' },
  locked:  { active: 'bg-destructive text-white',         dot: 'bg-destructive', bar: 'bg-destructive/10 border-destructive/30', text: 'text-destructive' },
};

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  return `${h}h${m}`;
}

export default function SystemStepper({ phase, settings, reservedCount, pickedUpCount, totalReserved }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  if (phase === 'locked') {
    const style = PHASE_STYLES.locked;
    return (
      <div className={`mb-6 flex items-center gap-3 p-4 rounded-xl border ${style.bar}`}>
        <Lock className={`w-5 h-5 flex-shrink-0 ${style.text}`} />
        <div>
          <p className={`font-semibold text-sm ${style.text}`}>Sistema bloqueado manualmente</p>
          <p className="text-xs text-muted-foreground">O administrador travou o sistema.</p>
        </div>
      </div>
    );
  }

  const currentPhaseIdx = PHASES.findIndex(p => p.key === phase);
  const style = PHASE_STYLES[phase] || PHASE_STYLES.done;

  const subtitles = {
    reserve: `Reservas abertas até ${formatTime(settings.reserva_fim)} · ${reservedCount} reservada${reservedCount !== 1 ? 's' : ''}`,
    waiting: `Aguardando início da retirada às ${formatTime(settings.retirada_inicio)}`,
    pickup:  `Retirada até ${formatTime(settings.retirada_fim)} · ${pickedUpCount}/${totalReserved} retirada${pickedUpCount !== 1 ? 's' : ''}`,
    done:    'Operação encerrada por hoje',
  };

  return (
    <div className={`mb-6 rounded-xl border p-4 ${style.bar}`}>
      {/* Stepper steps */}
      <div className="flex items-center gap-0 mb-3">
        {PHASES.map((p, idx) => {
          const Icon = p.icon;
          const isActive = idx === currentPhaseIdx;
          const isDone = idx < currentPhaseIdx;

          return (
            <React.Fragment key={p.key}>
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isActive ? style.active :
                  isDone ? 'bg-muted-foreground/20 text-muted-foreground' :
                  'bg-muted text-muted-foreground/40'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-[10px] font-medium hidden sm:block ${
                  isActive ? style.text :
                  isDone ? 'text-muted-foreground' :
                  'text-muted-foreground/40'
                }`}>{p.label}</span>
              </div>
              {idx < PHASES.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 rounded ${isDone ? 'bg-muted-foreground/30' : 'bg-muted'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Progress bar */}
      <ProgressBar phase={phase} settings={settings} now={now} style={style} />

      {/* Subtitle */}
      <p className={`text-xs mt-2 font-medium ${style.text}`}>{subtitles[phase] || ''}</p>
    </div>
  );
}

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function ProgressBar({ phase, settings, now, style }) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let startMin, endMin;
  if (phase === 'reserve') {
    startMin = timeToMinutes(settings.reserva_inicio);
    endMin = timeToMinutes(settings.reserva_fim);
  } else if (phase === 'waiting') {
    startMin = timeToMinutes(settings.reserva_fim);
    endMin = timeToMinutes(settings.retirada_inicio);
  } else if (phase === 'pickup') {
    startMin = timeToMinutes(settings.retirada_inicio);
    endMin = timeToMinutes(settings.retirada_fim);
  } else {
    return null;
  }

  const total = endMin - startMin;
  const elapsed = Math.min(Math.max(currentMinutes - startMin, 0), total);
  const pct = total > 0 ? Math.round((elapsed / total) * 100) : 100;

  return (
    <div className="w-full h-1.5 bg-black/10 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-1000 ${style.dot}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}