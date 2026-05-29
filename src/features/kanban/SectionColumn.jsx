import React from 'react';
import { Clock, Receipt } from 'lucide-react';
import { KanbanCard } from './KanbanCard';
import { canAdvance, canBudget } from '../../lib/helpers';

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

export function SectionColumn({ section, items, onCardClick, onAdvance, onCargarPresupuesto, user }) {
  const Icon           = section.icon;
  const esRmaSolicitada = section.id === 'rma_solicitada';

  let sinPresupuesto = [];
  let conPresupuesto = [];
  if (esRmaSolicitada) {
    items.forEach(t => {
      if (t.tienePresupuesto) conPresupuesto.push(t);
      else sinPresupuesto.push(t);
    });
  }

  return (
    <div className="relative bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r ${section.bar}`}></div>

      <div className="pl-5 pr-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-md ${section.bg} ${section.text} flex items-center justify-center border ${section.border}`}>
            <Icon size={14} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="font-semibold text-[14px] text-slate-900 leading-tight">{section.name}</h3>
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

      <div className="px-3 pb-3 space-y-3">
        {items.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 italic">Sin solicitudes en esta etapa</div>
        ) : esRmaSolicitada ? (
          <>
            {sinPresupuesto.length > 0 && (
              <SubGroup title="Sin presupuesto" count={sinPresupuesto.length} icon={Clock} color="orange">
                {sinPresupuesto.map(task => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    section={section}
                    canAdvance={canAdvance(task, user)}
                    canBudget={canBudget(task, user)}
                    onClick={() => onCardClick(task)}
                    onAdvance={() => onAdvance(task)}
                    onCargarPresupuesto={() => onCargarPresupuesto && onCargarPresupuesto(task)}
                  />
                ))}
              </SubGroup>
            )}
            {conPresupuesto.length > 0 && (
              <SubGroup title="Con presupuesto" count={conPresupuesto.length} icon={Receipt} color="emerald">
                {conPresupuesto.map(task => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    section={section}
                    canAdvance={canAdvance(task, user)}
                    canBudget={canBudget(task, user)}
                    onClick={() => onCardClick(task)}
                    onAdvance={() => onAdvance(task)}
                  />
                ))}
              </SubGroup>
            )}
          </>
        ) : (
          items.map(task => (
            <KanbanCard
              key={task.id}
              task={task}
              section={section}
              canAdvance={canAdvance(task, user)}
              canBudget={canBudget(task, user)}
              onClick={() => onCardClick(task)}
              onAdvance={() => onAdvance(task)}
            />
          ))
        )}
      </div>
    </div>
  );
}
