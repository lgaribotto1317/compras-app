import React from 'react';
import { X } from 'lucide-react';

// Contenedor genérico para todos los modales.
// - Header sticky (siempre visible aunque haya scroll interno).
// - Body con overflow-y-auto.
// - Click en el backdrop cierra el modal.
// - size: 'md' | 'lg' | 'xl' | '2xl'
// - hideTitle: oculta el header y muestra solo el botón X flotante (usado en DetailModal).

const SIZES = {
  md:  'max-w-md',
  lg:  'max-w-lg',
  xl:  'max-w-xl',
  '2xl': 'max-w-2xl'
};

export function ModalShell({ onClose, title, subtitle, children, footer, hideTitle, size = 'md' }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-fade-in p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`bg-white w-full ${SIZES[size] || SIZES.md} rounded-xl shadow-2xl animate-slide-up max-h-[96vh] flex flex-col overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        {!hideTitle ? (
          <div className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4 pb-3 border-b border-slate-100 bg-white shrink-0">
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-slate-900 leading-tight">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="p-1.5 -mr-1 hover:bg-slate-100 rounded-md text-slate-500 shrink-0">
              <X size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 hover:bg-slate-100 rounded-md text-slate-500 z-10 bg-white/80 backdrop-blur-sm"
          >
            <X size={18} />
          </button>
        )}

        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-slate-100 bg-white px-4 sm:px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Piezas reutilizables dentro de modales ────────────────────────

export function Field({ label, required, children, hint, error }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-600 mb-1.5 block">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint  && !error && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
      {error &&           <p className="text-[11px] text-red-600 mt-1 font-medium">{error}</p>}
    </label>
  );
}

export function ModalActions({ onClose, onSubmit, disabled, submitLabel }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onClose}
        className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
      >
        Cancelar
      </button>
      <button
        onClick={onSubmit}
        disabled={disabled}
        className="flex-[1.5] px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitLabel}
      </button>
    </div>
  );
}
