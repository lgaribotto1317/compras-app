import React, { useState, useCallback } from 'react';
import { CheckSquare, X } from 'lucide-react';
import { SECTIONS, SECTION_BY_ID, CONSOLIDA_EN } from '../../lib/constants';
import { canAdvance } from '../../lib/helpers';
import { SectionColumn } from './SectionColumn';

export function KanbanView({
  activeSection,
  setActiveSection,
  tasksInSection,
  onCardClick,
  onGroupClick,        // (group) => void — abre la composición del grupo
  onAdvance,            // (rows, fromSection) => void
  onCargarPresupuesto,
  user
}) {
  // ── Estado de selección (consolidación N→1) ──
  // Solo una columna puede estar en modo selección a la vez.
  const [selectSection, setSelectSection] = useState(null);
  const [selectedIds,   setSelectedIds]   = useState(() => new Set());

  const enterSelect = useCallback((sectionId) => {
    setSelectSection(sectionId);
    setSelectedIds(new Set());
  }, []);

  const exitSelect = useCallback(() => {
    setSelectSection(null);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((ids) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allIn = ids.length > 0 && ids.every(id => next.has(id));
      if (allIn) ids.forEach(id => next.delete(id));
      else       ids.forEach(id => next.add(id));
      return next;
    });
  }, []);

  // Inicia el avance consolidado de la selección y sale del modo selección.
  // Optimista: si el avance falla, el modal muestra el error y el usuario
  // vuelve a seleccionar.
  const advanceSelection = useCallback((rows, fromSection) => {
    exitSelect();
    onAdvance(rows, fromSection);
  }, [exitSelect, onAdvance]);

  // Props de cada columna (sin el toggle de entrar/salir, que vive en el slot).
  function columnProps(section, items) {
    const selectMode = selectSection === section.id;
    return {
      section,
      items,
      onCardClick,
      onGroupClick,
      onAdvance,
      onCargarPresupuesto,
      user,
      selectMode,
      selectedIds: selectMode ? selectedIds : undefined,
      onToggleSelect: toggleSelect,
      onAdvanceSelection: advanceSelection
    };
  }

  // Slot superior uniforme (misma altura en las 5 columnas → headers alineados).
  // En columnas consolidables muestra el toggle "Seleccionar para consolidación".
  function SelectSlot({ section, items }) {
    const selectable = CONSOLIDA_EN.includes(section.id);
    const puedeAvanzar = selectable && items.some(t => canAdvance(t, user));
    const selectMode = selectSection === section.id;
    return (
      <div className="h-9 mb-1.5 flex items-center">
        {selectable && (selectMode || puedeAvanzar) && (
          selectMode ? (
            <button
              onClick={exitSelect}
              className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 hover:bg-slate-200 px-2 py-1.5 rounded-md transition-colors whitespace-nowrap"
            >
              <X size={12} strokeWidth={2.5} />
              Salir de selección
            </button>
          ) : (
            <button
              onClick={() => enterSelect(section.id)}
              className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 hover:bg-sky-100 px-2 py-1.5 rounded-md transition-colors whitespace-nowrap"
            >
              <CheckSquare size={12} strokeWidth={2.5} />
              Seleccionar para consolidación
            </button>
          )
        )}
      </div>
    );
  }

  return (
    <>
      {/* Hero desktop */}
      <div className="hidden md:flex md:items-end md:justify-between mb-5">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 leading-tight">Flujo de compras</h2>
          <p className="text-slate-500 text-sm mt-1">Gestión de solicitudes, RMAs y órdenes de compra</p>
        </div>
      </div>

      {/* MOBILE: una sola sección visible */}
      <div className="md:hidden">
        {(() => {
          const section = SECTION_BY_ID[activeSection];
          const items = tasksInSection(activeSection);
          return (
            <>
              <SelectSlot section={section} items={items} />
              <SectionColumn {...columnProps(section, items)} />
            </>
          );
        })()}
      </div>

      {/* DESKTOP: 5 columnas en simultáneo */}
      <div className="hidden md:grid md:grid-cols-5 md:gap-3 md:items-start">
        {SECTIONS.map(section => {
          const items = tasksInSection(section.id);
          return (
            <div key={section.id} className="min-w-0">
              <SelectSlot section={section} items={items} />
              <SectionColumn {...columnProps(section, items)} />
            </div>
          );
        })}
      </div>
    </>
  );
}
