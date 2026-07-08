// ─── lib/notifications.js ──────────────────────────────────────────
// Lógica pura (sin I/O) para el sistema de notificaciones in-app.
// Separado de useNotifications.js para poder testear/reusar sin Supabase.
//
// Alcance acordado (Leo, jul/2026):
// - Califican: creada, creada con presupuesto, Generar RMA, Generar OC,
//   Finalizar compra, Corrección manual (revertir finalización), cancelada.
// - Valorizar RMA NO califica (decisión explícita: "ya los sacamos").
//   No es un cambio de sección real — el trigger solo permite 3 transiciones
//   (rma_solicitada→rma_generada→oc_generada→finalizadas); "Valorizar RMA" es
//   la etiqueta de una edición de campo (cma_number/monto) dentro de rma_generada.
// - editada / archivo agregado / archivo eliminado / presupuesto cargado /
//   presupuesto removido / factura-comentarios actualizados / eliminada:
//   NO califican.
//
// PENDIENTE: cuando se complete el feature de "revert un paso atrás"
// (SectionColumn.jsx, ver handoff), sumar acá el string de `action` que
// vaya a loguear esa operación.

export const QUALIFYING_ACTIONS = [
  'creada',
  'creada con presupuesto',
  'Generar RMA',
  'Generar OC',
  'Finalizar compra',
  'Corrección manual (revertir finalización)',
  'cancelada'
];

// Categoría de banner por acción. Determina el desglose "N nuevas · M
// avanzaron de etapa · K canceladas". Una card con varios eventos
// calificados en la ventana cuenta UNA sola vez, bajo la categoría de
// su evento más reciente (decisión de Leo).
export function categorizeAction(action) {
  if (action === 'creada' || action === 'creada con presupuesto') return 'nuevas';
  if (action === 'cancelada') return 'canceladas';
  // Generar RMA / Generar OC / Finalizar compra / Corrección manual...
  return 'avanzaron';
}

// ── Clave de agrupación (consolidación N→1) ────────────────────────
// Refleja cómo el Kanban ya consolida cards (rma_solicitada = individual;
// rma_generada agrupa por rma_number; oc_generada/finalizadas agrupan por
// oc_number). Usada para: (a) categorizar UNA vez por card visible, no por
// fila cruda de solicitud, y (b) expandir esa card calificada a TODAS las
// filas que la componen (para que el filtro "ver actualizadas" muestre el
// grupo completo, no filas sueltas).
//
// SUPUESTO A CONFIRMAR: esta función asume los mismos nombres de campo que
// ya usa useSolicitudes.js (rmaNumber/ocNumber en camelCase sobre el objeto
// `task`, rma_number/oc_number en snake_case crudo desde Supabase). Si
// SectionColumn.jsx/constants.js usan otra clave de agrupación (ej. algo
// vinculado a cma_number), avisar para ajustar esta función — no vi esos
// archivos.
export function notifGroupKey({ id, section, rmaNumber, ocNumber }) {
  if (section === 'rma_generada') return rmaNumber ? `rma:${rmaNumber}` : `sol:${id}`;
  if (section === 'oc_generada' || section === 'finalizadas') return ocNumber ? `oc:${ocNumber}` : `sol:${id}`;
  return `sol:${id}`; // rma_solicitada u otra: sin consolidación
}

// Variante para filas crudas devueltas por el join de Supabase
// (history_events embebiendo su solicitud padre, campos snake_case).
export function notifGroupKeyRaw(solicitudId, sol) {
  if (!sol) return `sol:${solicitudId}`;
  if (sol.section === 'rma_generada') return sol.rma_number ? `rma:${sol.rma_number}` : `sol:${solicitudId}`;
  if (sol.section === 'oc_generada' || sol.section === 'finalizadas') return sol.oc_number ? `oc:${sol.oc_number}` : `sol:${solicitudId}`;
  return `sol:${solicitudId}`;
}

// Arma { nuevas, avanzaron, canceladas, total } a partir de un mapa
// groupKey -> acción más reciente de ese grupo.
export function buildSummary(latestActionByGroup) {
  const counts = { nuevas: 0, avanzaron: 0, canceladas: 0 };
  for (const action of latestActionByGroup.values()) {
    counts[categorizeAction(action)]++;
  }
  const total = counts.nuevas + counts.avanzaron + counts.canceladas;
  return { ...counts, total };
}

// Texto del desglose, ej. "3 avanzaron de etapa · 2 nuevas · 1 cancelada".
// Omite categorías en cero. Orden fijo: nuevas, avanzaron, canceladas.
export function summaryText(summary) {
  const parts = [];
  if (summary.nuevas > 0) parts.push(`${summary.nuevas} nueva${summary.nuevas === 1 ? '' : 's'}`);
  if (summary.avanzaron > 0) parts.push(`${summary.avanzaron} avanz${summary.avanzaron === 1 ? 'ó' : 'aron'} de etapa`);
  if (summary.canceladas > 0) parts.push(`${summary.canceladas} cancelada${summary.canceladas === 1 ? '' : 's'}`);
  return parts.join(' · ');
}
