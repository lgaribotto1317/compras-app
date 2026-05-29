import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Lock, LogOut } from 'lucide-react';

// ─── UserMenu ─────────────────────────────────────────────────────
// Menú desplegable que se abre al clickear el chip con el email del
// usuario en el header. Incluye:
//   - "Cambiar contraseña" → dispara onChangePassword
//   - "Cerrar sesión"      → dispara onSignOut
//
// Diseñado para vivir en el header oscuro. El dropdown se posiciona
// abajo a la derecha del chip.
//
// Se cierra automáticamente al:
//   - clickear fuera (handler en window)
//   - apretar Escape
//   - elegir una opción

export function UserMenu({ user, onChangePassword, onSignOut }) {
  const [open, setOpen] = useState(false);
  const containerRef    = useRef(null);

  // Cerrar al click fuera o Escape
  useEffect(() => {
    if (!open) return;

    function onMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function handleAction(fn) {
    setOpen(false);
    fn();
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Chip clickeable con el email */}
      <button
        onClick={() => setOpen(o => !o)}
        title={user.email}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-700/50 hover:bg-slate-700 text-slate-200 border border-slate-600 text-[11px] font-medium max-w-[220px] transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
        <span className="truncate">{user.email}</span>
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden z-50">
          {/* Cabecera con el email (porque en el chip arriba está truncado y
              queda más prolijo mostrarlo entero acá adentro). */}
          <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Sesión</p>
            <p className="text-xs text-slate-900 font-medium truncate">{user.email}</p>
          </div>

          <button
            onClick={() => handleAction(onChangePassword)}
            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2 transition-colors"
          >
            <Lock size={13} className="text-slate-500" />
            Cambiar contraseña
          </button>

          <button
            onClick={() => handleAction(onSignOut)}
            className="w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 flex items-center gap-2 transition-colors border-t border-slate-100"
          >
            <LogOut size={13} className="text-red-500" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
