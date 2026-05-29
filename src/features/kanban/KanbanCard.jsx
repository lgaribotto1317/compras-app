import React from 'react';
import {
  User, Building2, Truck, Paperclip, Receipt, AlertTriangle,
  ShieldCheck, Clock, ChevronRight, XCircle
} from 'lucide-react';
import { PRIORIDADES, FLOW_STEPS } from '../../lib/constants';

export function KanbanCard({ task, section, onClick, onAdvance, onCargarPresupuesto, canAdvance = false, canBudget = false }) {
  const isFinal        = task.section === 'finalizadas';
  const isCancelled    = !!task.cancelledAt;
  const prioCfg        = PRIORIDADES.find(p => p.value === task.prioridad);
  const step           = FLOW_STEPS[task.section];
  const attCount       = (task.attachments || []).length;
  const enSolicitada   = task.section === 'rma_solicitada';
  const sinPresupuesto = enSolicitada && !task.tienePresupuesto && !isCancelled;

  // ── Estilos del contenedor ──
  // Cancelada: borde rojo punteado + opacidad reducida + bg rosado suave.
  // El detalle (click) sigue funcionando para que pueda ver el motivo,
  // pero los botones de avance NO se renderizan más abajo.
  const containerClass = isCancelled
    ? 'bg-red-50/30 rounded-md border-2 border-dashed border-red-300 overflow-hidden opacity-60 hover:opacity-80 transition-opacity'
    : `bg-white rounded-md border shadow-sm overflow-hidden transition-colors ${
        sinPresupuesto ? 'border-orange-200 hover:border-orange-300' : 'border-slate-200 hover:border-slate-300'
      }`;

  return (
    <div className={containerClass}>
      <button onClick={onClick} className="w-full text-left p-3 hover:bg-slate-50/50 transition-colors">

        {/* Badge "CANCELADA" arriba de todo, antes que cualquier otro chrome */}
        {isCancelled && (
          <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-red-200">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
              <XCircle size={10} strokeWidth={2.5} />
              Cancelada
            </span>
            {task.numero && (
              <span className="font-mono text-[10px] text-red-700 font-semibold tabular-nums">
                {task.numero}
              </span>
            )}
          </div>
        )}

        {/* Número + prioridad — solo si NO está cancelada (la cancelada ya
            mostró el número arriba junto al badge, y la prioridad pierde
            sentido cosmético cuando está fuera del flujo). */}
        {!isCancelled && (
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-mono text-[10px] text-slate-500 font-semibold tabular-nums">
              {task.numero || '—'}
            </span>
            {prioCfg && (
              <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${prioCfg.chip}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${prioCfg.dot}`}></span>
                {task.prioridad}
              </span>
            )}
          </div>
        )}

        <p className={`font-semibold text-[13px] leading-snug ${isCancelled ? 'text-slate-600 line-through decoration-red-400/50' : 'text-slate-900'}`}>
          {task.name}
        </p>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-[11px] text-slate-500">
          {task.solicitante && <span className="inline-flex items-center gap-1"><User size={10} />{task.solicitante}</span>}
          {task.area        && <span className="inline-flex items-center gap-1"><Building2 size={10} />{task.area}</span>}
          {task.proveedor   && <span className="inline-flex items-center gap-1"><Truck size={10} />{task.proveedor}</span>}
          {attCount > 0     && <span className="inline-flex items-center gap-1"><Paperclip size={10} />{attCount}</span>}
        </div>

        {(task.rmaNumber || task.ocNumber) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {task.rmaNumber && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-50 text-sky-800 border border-sky-200">
                RMA · {task.rmaNumber}
              </span>
            )}
            {task.ocNumber && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-violet-50 text-violet-800 border border-violet-200">
                OC · {task.ocNumber}
              </span>
            )}
            {task.proveedorAdjudicado && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-violet-50 text-violet-800 border border-violet-200">
                <Truck size={10} /> {task.proveedorAdjudicado}
              </span>
            )}
          </div>
        )}

        {/* Chips de estado — ocultos si está cancelada (no aportan info útil
            sobre algo fuera del flujo). El motivo de cancelación se ve al
            abrir el detalle. */}
        {!isCancelled && (
          <div className="flex flex-wrap gap-1 mt-2">
            {sinPresupuesto && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded">
                <Clock size={10} /> Sin presupuesto
              </span>
            )}
            {enSolicitada && task.tienePresupuesto && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                <Receipt size={10} /> Presupuestada
              </span>
            )}
            {task.paradaDePlanta && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                <AlertTriangle size={10} /> Parada de planta
              </span>
            )}
            {task.auditoriaInspeccion && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded">
                <ShieldCheck size={10} /> Auditoría
              </span>
            )}
          </div>
        )}
      </button>

      {/* Botón cargar presupuesto — solo en rma_solicitada sin presupuesto,
          NO cancelada, y solo si el user tiene canBudget. */}
      {sinPresupuesto && canBudget && onCargarPresupuesto && (
        <div className="px-3 pb-2">
          <button
            onClick={e => { e.stopPropagation(); onCargarPresupuesto(); }}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-3 rounded-md flex items-center justify-center gap-1.5 transition-colors"
          >
            <Receipt size={13} strokeWidth={2.5} />
            Cargar presupuesto
          </button>
        </div>
      )}

      {/* Botón avanzar etapa — oculto si está cancelada, finalizada, o sin permiso */}
      {!isFinal && !isCancelled && canAdvance && step && (
        <div className="px-3 pb-3">
          <button
            onClick={e => { e.stopPropagation(); onAdvance(); }}
            className={`w-full ${section.btn} text-white text-xs font-semibold py-2 px-3 rounded-md flex items-center justify-center gap-1.5 transition-colors`}
          >
            {step.label}
            <ChevronRight size={13} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}
