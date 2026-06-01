import React from 'react';
import { Clock, Receipt, ChevronRight } from 'lucide-react';
import { KanbanCard } from './KanbanCard';
import { canAdvance, canBudget, groupItems, advanceableIds } from '../../lib/helpers';
import { FLOW_STEPS } from '../../lib/constants';

function SubGroup({ title, count, icon: Icon, color, children }) {
  const colors = {
    orange: 'text-orange-700 bg-orange-50 border-orange-200',
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200'
  };
  return (
    <div>
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-semibold uppercase tracking-wider mb-2 ${colors[color]}`}>
        <Icon size={11} strokeWidth={2.5} />
        <span>{title}</span>
        <span className="ml-auto font-mono tabular-nums">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function SectionColumn({
  section, items, onCardClick, onGroupClick, onAdvance, onCargarPresupuesto, user,
  // Consolidación N→1 (modo selección): el toggle de entrar/salir vive en
  // KanbanView (arriba de la columna). Acá solo recibimos el estado.
  selectMode = false, selectedIds,
  onToggleSelect, onAdvanceSelection
}) {
  const Icon            = section.icon;
  const esRmaSolicitada = section.id === 'rma_solicitada';
  const step            = FLOW_STEPS[section.id];
  const selSet          = selectedIds || new Set();

  // Filas actualmente seleccionadas (de esta columna) y su recuento.
  const selectedRows = items.filter(t => selSet.has(t.id));

  // ── Card individual (rma_solicitada) ──
  function renderTaskCard(task) {
    const sm       = selectMode && !task.cancelledAt;
    const selected = selSet.has(task.id);
    return (
      <KanbanCard
        key={task.id}
        task={task}
        section={section}
        canAdvance={!selectMode && canAdvance(task, user)}
        canBudget={!selectMode && canBudget(task, user)}
        selectMode={sm}
        selected={selected}
        onToggleSelect={() => onToggleSelect && onToggleSelect([task.id])}
        onClick={() => sm ? onToggleSelect && onToggleSelect([task.id]) : onCardClick(task)}
        onAdvance={() => onAdvance([task], section.id)}
        onCargarPresupuesto={() => onCargarPresupuesto && onCargarPresupuesto(task)}
      />
    );
  }

  // ── Card de grupo (rma_generada / rma_valorizada / oc_generada / finalizadas) ──
  function renderGroupCard(group) {
    const ids      = advanceableIds(group);
    const sm       = selectMode && ids.length > 0;
    const selected = ids.length > 0 && ids.every(id => selSet.has(id));
    return (
      <KanbanCard
        key={group.rep.id}
        task={group.rep}
        group={group}
        section={section}
        canAdvance={!selectMode && canAdvance(group.rep, user)}
        canBudget={false}
        selectMode={sm}
        selected={selected}
        onToggleSelect={() => onToggleSelect && onToggleSelect(ids)}
        onClick={() => sm ? onToggleSelect && onToggleSelect(ids) : (onGroupClick ? onGroupClick(group) : onCardClick(group.rep))}
        onAdvance={() => onAdvance(group.rows, section.id)}
      />
    );
  }

  // Subdivisión sin/con presupuesto solo en rma_solicitada
  let sinPresupuesto = [];
  let conPresupuesto = [];
  if (esRmaSolicitada) {
    items.forEach(t => {
      if (t.tienePresupuesto) conPresupuesto.push(t);
      else sinPresupuesto.push(t);
    });
  }

  // Grupos para las secciones consolidables/agrupadas
  const groups = esRmaSolicitada ? null : groupItems(items, section.id);

  return (
    <div className="relative bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r ${section.bar}`}></div>

      <div className="pl-5 pr-4 pt-4 pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-md ${section.bg} ${section.text} flex items-center justify-center border ${section.border} shrink-0`}>
            <Icon size={14} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-[14px] text-slate-900 leading-tight truncate">{section.name}</h3>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-0.5 font-mono">
              {items.length} {items.length === 1 ? 'item' : 'items'}
              {esRmaSolicitada && items.length > 0 && (
                <span className="ml-2 text-slate-400">
                  · {sinPresupuesto.length} sin · {conPresupuesto.length} con
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Barra de acción de selección */}
      {selectMode && (
        <div className="mx-3 mb-3 p-2.5 rounded-md bg-sky-50 border border-sky-200">
          <p className="text-[11px] text-sky-900 mb-2">
            <span className="font-semibold">{selectedRows.length}</span> seleccionada{selectedRows.length === 1 ? '' : 's'} · se consolidan en un mismo {section.id === 'rma_solicitada' ? 'RMA' : 'CMA'}
          </p>
          <button
            disabled={selectedRows.length === 0}
            onClick={() => onAdvanceSelection && onAdvanceSelection(selectedRows, section.id)}
            className={`w-full text-white text-xs font-semibold py-2 px-3 rounded-md flex items-center justify-center gap-1.5 transition-colors ${
              selectedRows.length === 0 ? 'bg-slate-300 cursor-not-allowed' : section.btn
            }`}
          >
            {step?.label} · {selectedRows.length}
            <ChevronRight size={13} strokeWidth={2.5} />
          </button>
        </div>
      )}

      <div className="px-3 pb-3 space-y-3">
        {items.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 italic">Sin solicitudes en esta etapa</div>
        ) : esRmaSolicitada ? (
          <>
            {sinPresupuesto.length > 0 && (
              <SubGroup title="Sin presupuesto" count={sinPresupuesto.length} icon={Clock} color="orange">
                {sinPresupuesto.map(renderTaskCard)}
              </SubGroup>
            )}
            {conPresupuesto.length > 0 && (
              <SubGroup title="Con presupuesto" count={conPresupuesto.length} icon={Receipt} color="emerald">
                {conPresupuesto.map(renderTaskCard)}
              </SubGroup>
            )}
          </>
        ) : (
          groups.map(renderGroupCard)
        )}
      </div>
    </div>
  );
}
