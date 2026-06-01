import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Check, X, Loader2, Truck } from 'lucide-react';

// ─── ProveedorCombobox ────────────────────────────────────────────
// Input con buscador desplegable sobre la lista de proveedores (730).
// Permite elegir uno de la lista (guarda código) o escribir uno libre
// ("Otro" → código null). Diseñado para vivir adentro de modales con
// body `overflow-y-auto`: el panel de resultados va IN-FLOW (empuja el
// contenido, el body scrollea) para evitar clipping del dropdown.
//
// Contrato:
//   props.value   : string  — nombre actual (legalName o texto libre)
//   props.codigo  : string|null — código del proveedor si vino de la lista
//   props.proveedores : [{ codigo, legalName }]
//   props.loading : bool    — lista todavía cargando
//   props.onChange({ name, codigo }) — se llama en cada cambio
//   props.placeholder, props.autoFocus
//
// Reglas de estado:
//   - Tipear = texto libre ⇒ onChange({ name: <texto>, codigo: null }).
//     (Editar el texto rompe el vínculo con un código previo, a propósito.)
//   - Elegir de la lista ⇒ onChange({ name: legalName, codigo }).
//   - Si `codigo` está seteado, mostramos un chip "cód. XXXXXX".

// Normaliza para búsqueda: minúsculas + sin acentos.
function norm(s) {
  return (s ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const MAX_VISIBLE = 50;

export function ProveedorCombobox({
  value = '',
  codigo = null,
  proveedores = [],
  loading = false,
  onChange,
  placeholder = 'Buscar proveedor por nombre o código...',
  autoFocus = false
}) {
  // `query` es el texto del input. Se inicializa con value y a partir de
  // ahí es la fuente mientras el modal está vivo (el padre no lo resetea).
  const [query, setQuery]       = useState(value || '');
  const [open, setOpen]         = useState(false);
  const [highlight, setHighlight] = useState(0);

  const wrapRef  = useRef(null);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  // Cerrar al click fuera del componente.
  useEffect(() => {
    function onDocMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  // Resultados filtrados (nombre o código). Query vacío ⇒ primeros N.
  const { items, hasMore } = useMemo(() => {
    const q = norm(query.trim());
    let matched;
    if (!q) {
      matched = proveedores;
    } else {
      matched = proveedores.filter(p =>
        norm(p.legalName).includes(q) || norm(p.codigo).includes(q)
      );
    }
    return {
      items: matched.slice(0, MAX_VISIBLE),
      hasMore: matched.length > MAX_VISIBLE
    };
  }, [query, proveedores]);

  // ¿Mostramos la opción "Otro"? Cuando hay texto y no coincide EXACTO
  // (por nombre) con algo ya seleccionado de la lista.
  const trimmed = query.trim();
  const exactCoded = codigo && norm(value) === norm(trimmed);
  const showOtro   = trimmed.length > 0 && !exactCoded;

  // Cantidad total de filas navegables (items + fila Otro si aplica).
  const otroIndex = items.length; // la fila Otro va después de los items
  const navCount  = items.length + (showOtro ? 1 : 0);

  function commitFromList(p) {
    setQuery(p.legalName);
    onChange?.({ name: p.legalName, codigo: p.codigo });
    setOpen(false);
    inputRef.current?.blur();
  }

  function commitOtro() {
    onChange?.({ name: trimmed, codigo: null });
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleInput(e) {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    setHighlight(0);
    // Tipear = texto libre; se rompe el vínculo con un código previo.
    onChange?.({ name: v, codigo: null });
  }

  function handleClear() {
    setQuery('');
    onChange?.({ name: '', codigo: null });
    setOpen(true);
    setHighlight(0);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setHighlight(h => Math.min(h + 1, Math.max(navCount - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (!open) return;
      e.preventDefault();
      if (highlight < items.length) {
        commitFromList(items[highlight]);
      } else if (showOtro && highlight === otroIndex) {
        commitOtro();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  // Mantener visible la fila resaltada al navegar con teclado.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlight}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  return (
    <div ref={wrapRef} className="relative">
      {/* Input + iconos */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          className="w-full pl-8 pr-16 py-2.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {codigo && (
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200" title="Proveedor de la lista">
              cód. {codigo}
            </span>
          )}
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
              title="Limpiar"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Panel de resultados (in-flow para evitar clipping en modales) */}
      {open && (
        <div className="mt-1 border border-slate-200 rounded-md bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-500">
              <Loader2 size={13} className="animate-spin" /> Cargando proveedores...
            </div>
          ) : (
            <>
              <div ref={listRef} className="max-h-52 overflow-y-auto">
                {items.length === 0 && !showOtro && (
                  <div className="px-3 py-3 text-xs text-slate-500">Sin coincidencias.</div>
                )}

                {items.map((p, i) => {
                  const isSel = codigo === p.codigo && norm(value) === norm(p.legalName);
                  const isHi  = i === highlight;
                  return (
                    <button
                      key={p.codigo}
                      type="button"
                      data-idx={i}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => commitFromList(p)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        isHi ? 'bg-sky-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-mono text-[10px] text-slate-400 w-14 shrink-0 tabular-nums">{p.codigo}</span>
                      <span className="flex-1 min-w-0 truncate text-slate-800">{p.legalName}</span>
                      {isSel && <Check size={14} className="text-sky-600 shrink-0" />}
                    </button>
                  );
                })}

                {/* Opción Otro (texto libre) */}
                {showOtro && (
                  <button
                    type="button"
                    data-idx={otroIndex}
                    onMouseEnter={() => setHighlight(otroIndex)}
                    onClick={commitOtro}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-t border-slate-100 transition-colors ${
                      highlight === otroIndex ? 'bg-amber-50' : 'hover:bg-amber-50/60'
                    }`}
                  >
                    <Truck size={13} className="text-amber-600 shrink-0" />
                    <span className="flex-1 min-w-0">
                      Usar <span className="font-medium text-amber-800">«{trimmed}»</span>
                      <span className="text-slate-500"> (no listado)</span>
                    </span>
                  </button>
                )}
              </div>

              {hasMore && (
                <div className="px-3 py-1.5 text-[10px] text-slate-400 border-t border-slate-100 bg-slate-50">
                  Mostrando {MAX_VISIBLE} de muchos · refiná la búsqueda
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
