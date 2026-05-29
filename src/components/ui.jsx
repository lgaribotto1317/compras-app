import React from 'react';
import { Package, Plus, Filter as FilterIcon, X as XIcon } from 'lucide-react';
import { ModalShell } from './ModalShell';

// ─── ConfirmModal ─────────────────────────────────────────────────
export function ConfirmModal({ title, message, confirmLabel, danger, onClose, onConfirm }) {
  return (
    <ModalShell onClose={onClose} title={title} subtitle={message}>
      <div className="flex gap-2 mt-4">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 px-4 py-2.5 text-sm font-semibold rounded-md transition-colors text-white ${
            danger ? 'bg-red-600 hover:bg-red-700' : 'bg-sky-600 hover:bg-sky-700'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Toast ────────────────────────────────────────────────────────
// Notificación fugaz fija al fondo de la pantalla.
export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-5 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:max-w-sm z-50 animate-slide-up flex justify-center">
      <div className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-full break-words ${
        toast.type === 'error' ? 'bg-red-600 text-red-50' : 'bg-slate-900 text-slate-50'
      }`}>
        {toast.message}
      </div>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────
// Pantalla cuando no hay solicitudes cargadas. La carga de samples
// ya no aplica (Supabase no permite inyección masiva desde el cliente).
export function EmptyState({ onCreate }) {
  return (
    <div className="text-center py-12 px-4 max-w-md mx-auto">
      <div className="w-16 h-16 mx-auto mb-5 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200">
        <Package size={28} className="text-slate-500" />
      </div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">Empezá tu flujo de compras</h3>
      <p className="text-slate-600 text-sm mb-6 leading-relaxed">
        Todavía no hay solicitudes cargadas. Creá la primera para arrancar.
      </p>
      <div className="flex justify-center">
        <button
          onClick={onCreate}
          className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 text-sm font-medium transition-colors"
        >
          <Plus size={15} strokeWidth={2.5} /> Nueva solicitud
        </button>
      </div>
    </div>
  );
}

// ─── FilterChip ───────────────────────────────────────────────────
// Chip de filtro reutilizable (usado en FiltersModal).
export function FilterChip({ active, onClick, label, dot }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all flex items-center gap-1.5 ${
        active
          ? 'bg-slate-900 text-slate-50 border-slate-900'
          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
      }`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`}></span>}
      {label}
    </button>
  );
}

// ─── FiltersBanner ────────────────────────────────────────────────
// Banner reutilizable que muestra los filtros activos. Se usa en Kanban y
// Dashboard. Recibe un array de chips activos { label, tone } y un onClear.
// tone: 'slate' (default) | 'red' (parada) | 'violet' (auditoría) | 'sky' (período).
// Si no hay chips, no renderiza nada.

const BANNER_TONES = {
  slate:  'bg-slate-100  text-slate-700  border-slate-200',
  red:    'bg-red-50     text-red-700    border-red-200',
  violet: 'bg-violet-50  text-violet-700 border-violet-200',
  sky:    'bg-sky-50     text-sky-700    border-sky-200'
};

export function FiltersBanner({ chips, filteredCount, totalCount, onClear }) {
  if (!chips || chips.length === 0) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 flex items-center gap-2 flex-wrap">
      <FilterIcon size={14} className="text-amber-700 shrink-0" />
      <span className="text-xs text-amber-900 font-semibold shrink-0">Filtros activos:</span>
      <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
        {chips.map((c, i) => (
          <span
            key={i}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border ${BANNER_TONES[c.tone] || BANNER_TONES.slate}`}
          >
            {c.label}
          </span>
        ))}
      </div>
      <span className="text-[11px] text-amber-800 font-mono shrink-0">
        {filteredCount} de {totalCount}
      </span>
      <button
        onClick={onClear}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 hover:text-amber-900 hover:bg-amber-100 px-2 py-1 rounded transition-colors shrink-0"
      >
        <XIcon size={11} /> Limpiar
      </button>
    </div>
  );
}
