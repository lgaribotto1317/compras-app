import React from 'react';
import {
  User, Building2, Truck, Paperclip, Receipt, AlertTriangle,
  ShieldCheck, Clock, ChevronRight, XCircle, Check, Layers
} from 'lucide-react';
import { PRIORIDADES, FLOW_STEPS } from '../../lib/constants';

// KanbanCard: representa UNA solicitud (rma_solicitada) o UN GRUPO (resto de
// las secciones, consolidación N→1). Cuando `group` viene con count > 1, la
// card muestra agregados del grupo (recuento, áreas, flags) en vez de los de
// la fila representativa.
//
// Modo selección (`selectMode`): la card muestra un check a la izquierda y el
// click togglea la selección en vez de abrir el detalle. Los botones de avance
// y presupuesto se ocultan (el avance se hace desde la barra de selección).
export function KanbanCard({
  task, section, group = null,
  onClick, onAdvance, onCargarPresupuesto,
  canAdvance = false, canBudget = false,
  selectMode = false, selected = false, onToggleSelect
}) {
  const isFinal        = task.section === 'finalizadas';
  const isCancelled    = !!task.cancelledAt;
  const isGroup        = !!group && group.count > 1;

  // Agregados de grupo cuando corresponde; si no, campos de la fila.
  const prioridadVal   = isGroup ? group.prioridad           : task.prioridad;
  const paradaVal      = isGroup ? group.paradaDePlanta       : task.paradaDePlanta;
  const auditoriaVal   = isGroup ? group.auditoriaInspeccion  : task.auditoriaInspeccion;
  const attCount       = isGroup ? group.attachmentsCount     : (task.attachments || []).length;

  const prioCfg        = PRIORIDADES.find(p => p.value === prioridadVal);
  const step           = FLOW_STEPS[task.section];
  const enSolicitada   = task.section === 'rma_solicitada';
  const sinPresupuesto = enSolicitada && !task.tienePresupuesto && !isCancelled;

  // Título dinámico según la etapa (usa la fila representativa, que tiene el
  // número compartido del grupo):
  //   rma_solicitada              → número de solicitud (#00000N)
  //   rma_generada                → RMA {rma_number}
  //   rma_valorizada              → CMA {cma_number}
  //   oc_generada / finalizadas   → OMA {oc_number}
  let displayTitle = task.name;
  if (task.section === 'rma_solicitada') {
    displayTitle = task.numero || task.name;
  } else if (task.section === 'rma_generada') {
    displayTitle = task.rmaNumber ? `RMA ${task.rmaNumber}` : (task.numero || task.name);
  } else if (task.section === 'rma_valorizada') {
    displayTitle = task.cmaNumber ? `CMA ${task.cmaNumber}` : (task.rmaNumber ? `RMA ${task.rmaNumber}` : task.name);
  } else if (task.section === 'oc_generada' || task.section === 'finalizadas') {
    displayTitle = task.ocNumber ? `OMA ${task.ocNumber}` : (task.cmaNumber ? `CMA ${task.cmaNumber}` : task.name);
  }

  // Hijos consolidados según la etapa (para badge + lista de trazabilidad):
  //   rma_generada  → la RMA consolida SOLICITUDES (se listan sus #00000N)
  //   rma_valorizada/oc_generada/finalizadas → consolida RMA (se listan los RMA)
  let childKind = null;
  let childNumeros = [];
  if (group) {
    if (task.section === 'rma_generada') {
      childKind = 'solicitud';
      childNumeros = group.solicitudNumeros || [];
    } else if (task.section === 'rma_valorizada' || task.section === 'oc_generada' || task.section === 'finalizadas') {
      childKind = 'rma';
      childNumeros = group.rmaNumeros || [];
    }
  }
  const isConsolidado = childNumeros.length > 1;

  // ── Estilos del contenedor ──
  const containerClass = isCancelled
    ? 'bg-red-50/30 rounded-md border-2 border-dashed border-red-300 overflow-hidden opacity-60 hover:opacity-80 transition-opacity'
    : selected
      ? 'bg-sky-50 rounded-md border-2 border-sky-500 overflow-hidden transition-colors'
      : `bg-white rounded-md border shadow-sm overflow-hidden transition-colors ${
          sinPresupuesto ? 'border-orange-200 hover:border-orange-300' : 'border-slate-200 hover:border-slate-300'
        }`;

  return (
    <div className={containerClass}>
      <button onClick={onClick} className="w-full text-left p-3 hover:bg-slate-50/50 transition-colors">

        {/* Check de selección (modo selección, card no cancelada) */}
        {selectMode && !isCancelled && (
          <div className="flex items-center gap-2 mb-2">
            <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
              selected ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300 text-transparent'
            }`}>
              <Check size={11} strokeWidth={3} />
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              {selected ? 'Seleccionada' : 'Tocar para seleccionar'}
            </span>
          </div>
        )}

        {/* Badge CANCELADA */}
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

        {/* Número interno + prioridad — solo si NO está cancelada */}
        {!isCancelled && (
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-mono text-[10px] text-slate-500 font-semibold tabular-nums">
              {task.numero || '—'}
            </span>
            {prioCfg && (
              <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${prioCfg.chip}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${prioCfg.dot}`}></span>
                {prioridadVal}
              </span>
            )}
          </div>
        )}

        <p className={`font-semibold text-[13px] leading-snug ${isCancelled ? 'text-slate-600 line-through decoration-red-400/50' : 'text-slate-900'}`}>
          {displayTitle}
        </p>

        {/* Badge de consolidación + lista de los números que la componen */}
        {isConsolidado && (
          <div className="mt-1.5 space-y-1">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
              <Layers size={10} strokeWidth={2.5} />
              {childNumeros.length} {childKind === 'rma' ? 'RMA' : 'solicitudes'} consolidadas
            </span>
            <div className="flex flex-wrap gap-1">
              {childNumeros.map(n => (
                <span key={n} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-50 text-slate-600 border border-slate-200">
                  {childKind === 'rma' ? `RMA ${n}` : n}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-[11px] text-slate-500">
          {!isGroup && task.solicitante && <span className="inline-flex items-center gap-1"><User size={10} />{task.solicitante}</span>}
          {isGroup
            ? (group.areas.length > 0 && <span className="inline-flex items-center gap-1"><Building2 size={10} />{group.areas.join(', ')}</span>)
            : (task.area && <span className="inline-flex items-center gap-1"><Building2 size={10} />{task.area}</span>)
          }
          {!isGroup && task.proveedor && <span className="inline-flex items-center gap-1"><Truck size={10} />{task.proveedor}</span>}
          {attCount > 0 && <span className="inline-flex items-center gap-1"><Paperclip size={10} />{attCount}</span>}
        </div>

        {!isConsolidado && (task.rmaNumber || task.cmaNumber || task.ocNumber) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {task.rmaNumber && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-50 text-sky-800 border border-sky-200">
                RMA · {task.rmaNumber}
              </span>
            )}
            {task.cmaNumber && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-teal-50 text-teal-800 border border-teal-200">
                CMA · {task.cmaNumber}
              </span>
            )}
            {task.ocNumber && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-violet-50 text-violet-800 border border-violet-200">
                OMA · {task.ocNumber}
              </span>
            )}
            {task.proveedorAdjudicado && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-violet-50 text-violet-800 border border-violet-200">
                <Truck size={10} /> {task.proveedorAdjudicado}
              </span>
            )}
          </div>
        )}
        {isConsolidado && task.proveedorAdjudicado && (
          <div className="flex flex-wrap gap-1 mt-2">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-violet-50 text-violet-800 border border-violet-200">
              <Truck size={10} /> {task.proveedorAdjudicado}
            </span>
          </div>
        )}

        {/* Chips de estado — ocultos si está cancelada */}
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
            {paradaVal && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                <AlertTriangle size={10} /> Parada de planta
              </span>
            )}
            {auditoriaVal && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded">
                <ShieldCheck size={10} /> Auditoría
              </span>
            )}
          </div>
        )}
      </button>

      {/* Botón cargar presupuesto — solo rma_solicitada sin presupuesto, no cancelada,
          fuera de modo selección y con permiso. */}
      {!selectMode && sinPresupuesto && canBudget && onCargarPresupuesto && (
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

      {/* Botón avanzar etapa — oculto en modo selección, si está cancelada,
          finalizada, o sin permiso. En grupos avanza el grupo entero. */}
      {!selectMode && !isFinal && !isCancelled && canAdvance && step && (
        <div className="px-3 pb-3">
          <button
            onClick={e => { e.stopPropagation(); onAdvance(); }}
            className={`w-full ${section.btn} text-white text-xs font-semibold py-2 px-3 rounded-md flex items-center justify-center gap-1.5 transition-colors`}
          >
            {step.label}
            {isGroup && <span className="font-mono">· {group.count}</span>}
            <ChevronRight size={13} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}
