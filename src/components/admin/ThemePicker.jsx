import React from 'react';
import { useTheme, THEMES } from '@/lib/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Palette, Check } from 'lucide-react';

export default function ThemePicker() {
  const { themeId, setThemeId } = useTheme();

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="w-5 h-5 text-primary" /> Tema de Cores
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">Escolha a cor principal do sistema</p>
        <div className="flex flex-wrap gap-3">
          {THEMES.map(theme => (
            <button
              key={theme.id}
              type="button"
              onClick={() => setThemeId(theme.id)}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div
                className="w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all shadow-sm"
                style={{
                  backgroundColor: theme.color,
                  borderColor: themeId === theme.id ? theme.color : 'transparent',
                  boxShadow: themeId === theme.id ? `0 0 0 3px ${theme.color}40` : undefined,
                }}
              >
                {themeId === theme.id && <Check className="w-5 h-5 text-white" strokeWidth={3} />}
              </div>
              <span className={`text-xs font-medium transition-colors ${themeId === theme.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                {theme.label}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}