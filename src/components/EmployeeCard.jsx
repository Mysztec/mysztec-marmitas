import React from 'react';
import { User } from 'lucide-react';

const colors = [
  'bg-orange-100 text-orange-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-lime-100 text-lime-700',
];

export default function EmployeeCard({ employee, onClick, badge, badgeColor }) {
  const initials = employee.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const colorIndex = employee.name.charCodeAt(0) % colors.length;
  const avatarColor = colors[colorIndex];

  return (
    <button
      onClick={() => onClick(employee)}
      className="group flex flex-col items-center gap-3 p-5 rounded-2xl bg-card border border-border/60 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 active:scale-95 relative"
    >
      {badge && (
        <span className={`absolute top-3 right-3 text-xs font-semibold px-2.5 py-1 rounded-full ${badgeColor || 'bg-primary/10 text-primary'}`}>
          {badge}
        </span>
      )}
      <div className={`w-16 h-16 rounded-2xl ${avatarColor} flex items-center justify-center text-xl font-bold transition-transform group-hover:scale-105`}>
        {initials}
      </div>
      <span className="text-sm font-semibold text-foreground truncate max-w-full">{employee.name}</span>
      {employee.department && (
        <span className="text-xs text-muted-foreground -mt-2">{employee.department}</span>
      )}
    </button>
  );
}