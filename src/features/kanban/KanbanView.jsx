import React from 'react';
import { SECTIONS, SECTION_BY_ID } from '../../lib/constants';
import { SectionColumn } from './SectionColumn';

export function KanbanView({
  activeSection,
  setActiveSection,
  tasksInSection,
  onCardClick,
  onAdvance,
  onCargarPresupuesto,
  user           // Bloque 4: usado para calcular permisos por card
}) {
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
        <SectionColumn
          section={SECTION_BY_ID[activeSection]}
          items={tasksInSection(activeSection)}
          onCardClick={onCardClick}
          onAdvance={onAdvance}
          onCargarPresupuesto={onCargarPresupuesto}
          user={user}
        />
      </div>

      {/* DESKTOP: 4 columnas con scroll horizontal si no entran */}
      <div className="hidden md:flex md:items-start md:gap-4 md:overflow-x-auto md:pb-3 md:-mx-3 md:px-3">
        {SECTIONS.map(section => (
          <div
            key={section.id}
            className="flex-shrink-0 w-[20rem] lg:w-[22rem] xl:flex-1 xl:w-auto xl:min-w-[18rem]"
          >
            <SectionColumn
              section={section}
              items={tasksInSection(section.id)}
              onCardClick={onCardClick}
              onAdvance={onAdvance}
              onCargarPresupuesto={onCargarPresupuesto}
              user={user}
            />
          </div>
        ))}
      </div>
    </>
  );
}
