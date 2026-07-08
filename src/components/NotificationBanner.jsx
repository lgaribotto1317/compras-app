import React from 'react';
import { BellRing, X, Eye, EyeOff } from 'lucide-react';
import { summaryText } from '../lib/notifications';

// ─── NotificationBanner ─────────────────────────────────────────────
// Banner mostrado una vez por sesión cuando hay eventos calificados desde
// el último checkpoint del usuario. Dos acciones posibles, ambas pisan el
// checkpoint (definido con Leo):
// - onDismiss: cierra el aviso sin filtrar nada.
// - onViewUpdated: activa el filtro "ver actualizadas" del Kanban.
export function NotificationBanner({ summary, onViewUpdated, onDismiss }) {
  return (
    <div className="mb-4 bg-sky-50 border border-sky-200 rounded-xl p-3 flex items-center justify-between gap-3 flex-wrap animate-fade-in">
      <div className="flex items-center gap-2 text-sm text-sky-900 min-w-0">
        <BellRing size={16} className="text-sky-600 shrink-0" />
        <span className="truncate">Hay actualizaciones — {summaryText(summary)}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onViewUpdated}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 px-3 py-1.5 rounded-md transition-colors"
        >
          <Eye size={13} />
          Ver actualizadas
        </button>
        <button
          onClick={onDismiss}
          className="p-1.5 text-sky-400 hover:text-sky-700 hover:bg-sky-100 rounded-md transition-colors"
          aria-label="Cerrar aviso"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── UpdatedFilterChip ───────────────────────────────────────────────
// Chip persistente mientras el toggle "ver actualizadas" está activo.
// Reemplaza al banner (que ya cumplió su función al momento del clic).
// El filtro de Período queda ignorado mientras este chip está activo.
export function UpdatedFilterChip({ onExit }) {
  return (
    <div className="mb-4 bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
        <EyeOff size={13} className="text-slate-500 shrink-0" />
        Mostrando sólo solicitudes actualizadas — ignora el filtro de período
      </div>
      <button
        onClick={onExit}
        className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline underline-offset-2 shrink-0"
      >
        Salir
      </button>
    </div>
  );
}
