import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Delete, CheckCircle2 } from "lucide-react";

// Optional soft beep using Web Audio API
function playBeep(type = 'key') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'error') {
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else {
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    }
  } catch {
    // Audio e enfeite: navegador sem AudioContext nao pode quebrar o teclado.
  }
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'del'];

export default function PinDialog({ open, onOpenChange, employeeName, onConfirm, loading, title, description }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pressedKey, setPressedKey] = useState(null);
  const confirmingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setPin('');
      setError('');
      setShake(false);
      setSuccess(false);
      confirmingRef.current = false;
    }
  }, [open]);

  const triggerShake = () => {
    playBeep('error');
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleKey = useCallback((digit) => {
    if (loading || confirmingRef.current) return;
    playBeep('key');
    setPressedKey(digit);
    setTimeout(() => setPressedKey(null), 120);
    setError('');
    setPin(prev => prev.length < 4 ? prev + digit : prev);
  }, [loading]);

  const handleDelete = useCallback(() => {
    if (loading || confirmingRef.current) return;
    setError('');
    setPin(prev => prev.slice(0, -1));
  }, [loading]);

  // Envia sozinho ao completar o 4o digito.
  useEffect(() => {
    if (pin.length !== 4 || confirmingRef.current) return;
    confirmingRef.current = true;

    const recusar = (mensagem) => {
      setError(mensagem);
      setPin('');
      triggerShake();
      confirmingRef.current = false;
    };

    onConfirm(pin)
      .then(result => {
        if (result?.error) {
          recusar(result.error || 'PIN incorreto');
          return;
        }
        setSuccess(true);
        playBeep('success');
        setTimeout(() => { confirmingRef.current = false; }, 600);
      })
      // Sem este catch, uma falha inesperada deixava confirmingRef travado em
      // true: o teclado parava de responder e nenhuma mensagem aparecia.
      .catch(erro => {
        console.error('Falha ao confirmar o PIN:', erro);
        recusar('Erro de conexão. Tente novamente.');
      });
  }, [pin]);

  // Keyboard support
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key >= '0' && e.key <= '9') handleKey(e.key);
      if (e.key === 'Backspace') handleDelete();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, handleKey, handleDelete]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-sm sm:max-w-md p-0 overflow-hidden rounded-3xl">
        {/* Header */}
        <div className="bg-primary px-8 pt-8 pb-6 text-center">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary-foreground mb-1">
              {title || 'Confirmar'}
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80 text-sm">
              {description || `Olá, ${employeeName}! Digite sua senha.`}
            </DialogDescription>
          </DialogHeader>

          {/* PIN dots */}
          <div className={`flex justify-center gap-4 mt-6 ${shake ? 'animate-shake' : ''}`}>
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl transition-all duration-150 ${
                  success
                    ? 'bg-emerald-400 border-2 border-emerald-300'
                    : pin.length > i
                    ? 'bg-white/30 border-2 border-white shadow-inner'
                    : 'bg-white/10 border-2 border-white/30'
                }`}
              >
                {success
                  ? <CheckCircle2 className="w-6 h-6 text-white" />
                  : pin.length > i
                  ? <span className="text-white font-bold">●</span>
                  : <span className="text-white/40">○</span>
                }
              </div>
            ))}
          </div>

          {/* Error message */}
          <div className="h-6 mt-3">
            {error && (
              <p className="text-red-200 text-sm font-semibold animate-pulse">{error}</p>
            )}
          </div>
        </div>

        {/* Numpad */}
        <div className="bg-card px-6 py-5">
          <div className="grid grid-cols-3 gap-3">
            {KEYS.map((key, idx) => {
              if (key === null) return <div key={idx} />;

              if (key === 'del') return (
                <button
                  key="del"
                  onClick={handleDelete}
                  disabled={loading || pin.length === 0}
                  className="h-16 sm:h-18 rounded-2xl bg-muted hover:bg-destructive/10 active:scale-95 disabled:opacity-30 transition-all flex items-center justify-center text-muted-foreground hover:text-destructive border border-border"
                >
                  <Delete className="w-6 h-6" />
                </button>
              );

              const isPressed = pressedKey === key;
              return (
                <button
                  key={key}
                  onClick={() => handleKey(key)}
                  disabled={loading || pin.length >= 4 || success}
                  className={`h-16 sm:h-18 rounded-2xl border font-bold text-2xl transition-all select-none
                    ${isPressed
                      ? 'bg-primary text-primary-foreground border-primary scale-95 shadow-inner'
                      : 'bg-card border-border hover:bg-accent hover:border-primary/40 active:scale-95 shadow-sm text-foreground'
                    }
                    disabled:opacity-40`}
                >
                  {key}
                </button>
              );
            })}
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm mt-4">
              <Loader2 className="w-4 h-4 animate-spin" /> Verificando...
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}