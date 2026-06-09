import { SECTION_BY_ID } from '../../lib/constants';

// ─── Builders de hojas Excel ──────────────────────────────────────
// Funciones puras: reciben tasks + stats, devuelven array de objetos
// listos para XLSX.utils.json_to_sheet().
// Sin side effects, sin JSX.

export function buildResumen(stats) {
  return [
    { Métrica: 'Total de solicitudes',          Valor: stats.totales },
    { Métrica: 'En curso',                       Valor: stats.enCurso },
    { Métrica: 'Finalizadas',                    Valor: stats.finalizadas },
    { Métrica: 'Tasa de cierre (%)',             Valor: stats.tasaFinalizacion },
    { Métrica: 'Tiempo promedio de ciclo (días)', Valor: stats.tiempoPromedioCierre ?? '—' },
    { Métrica: 'Alta prioridad activas',         Valor: stats.altaPrioridad },
    { Métrica: 'Parada de planta activas',       Valor: stats.paradaPlanta },
    { Métrica: 'Auditoría/Inspección activas',   Valor: stats.auditoria },
    { Métrica: 'Sin presupuesto (activas)',       Valor: stats.totalSinPresupuesto },
    { Métrica: 'En RMA solicitada',              Valor: stats.porSeccion.rma_solicitada || 0 },
    { Métrica: 'En RMA generada',                Valor: stats.porSeccion.rma_generada  || 0 },
    { Métrica: 'En OC generada',                 Valor: stats.porSeccion.oc_generada   || 0 },
    { Métrica: 'Fecha de exportación',           Valor: new Date().toLocaleString('es-AR') }
  ];
}

export function buildSolicitudes(tasks) {
  return tasks.map(t => ({
    'Número':               t.numero || '—',
    'Título':               t.name,
    'Solicitante':          t.solicitante,
    'Área':                 t.area,
    'Proveedor':            t.proveedor || '',
    'Cód. proveedor':       t.proveedorCodigo || '',
    'Proveedor adjudicado': t.proveedorAdjudicado || '',
    'Cód. adjudicado':      t.proveedorAdjudicadoCodigo || '',
    'Prioridad':            t.prioridad,
    'Estado':               SECTION_BY_ID[t.section]?.name || t.section,
    'Tiene presupuesto':    t.tienePresupuesto ? 'Sí' : 'No',
    'Fecha presupuesto':    t.presupuestadaAt ? new Date(t.presupuestadaAt).toLocaleString('es-AR') : '',
    'Parada de planta':     t.paradaDePlanta     ? 'Sí' : 'No',
    'Auditoría/Inspección': t.auditoriaInspeccion ? 'Sí' : 'No',
    'Nro RMA':              t.rmaNumber   || '',
    'Nro CMA':              t.cmaNumber   || '',
    'Nro OMA':              t.ocNumber    || '',
    'Monto':                t.monto       || '',
    'N° Factura':           t.numeroFactura || '',
    'Fecha cierre':         t.fechaCierre || '',
    'Observaciones':        t.observaciones || '',
    'Comentarios RMA':      t.comentariosRma || '',
    'Comentarios OC':       t.comentariosOc || '',
    'Descripción':          t.descripcionDetallada || '',
    'Adjuntos':             (t.attachments || []).length,
    'Fecha creación':       new Date(t.createdAt).toLocaleString('es-AR'),
    'Última actualización': new Date(t.updatedAt).toLocaleString('es-AR'),
    'Días totales':         Math.floor((Date.now() - new Date(t.createdAt)) / 86400000)
  }));
}

export function buildTrazabilidad(tasks, resolveUserName = null) {
  const rows = [];
  tasks.forEach(t => {
    (t.history || []).forEach(h => {
      // Nombre completo desde profiles si está disponible; fallback al
      // username antes del @ (mismo criterio que la UI del DetailModal).
      const nombre = resolveUserName
        ? resolveUserName(h)
        : (h.userEmail ? h.userEmail.split('@')[0] : '');
      rows.push({
        'Número solicitud': t.numero || '—',
        'Título':           t.name,
        'Fecha/Hora':       new Date(h.at).toLocaleString('es-AR'),
        'Usuario':          nombre,
        'Email usuario':    h.userEmail || '',
        'Acción':           h.action,
        'Desde':            h.from ? (SECTION_BY_ID[h.from]?.name || h.from) : '',
        'Hacia':            h.to   ? (SECTION_BY_ID[h.to]?.name   || h.to)   : '',
        'Campos modificados': (h.fieldsChanged || []).join(', '),
        'Archivo':          h.attachmentName || '',
        'Motivo':           h.motivo || '',
        'Valores':          h.values
          ? Object.entries(h.values).map(([k, v]) => `${k}: ${v}`).join(' · ')
          : ''
      });
    });
  });
  rows.sort((a, b) => new Date(b['Fecha/Hora']) - new Date(a['Fecha/Hora']));
  return rows;
}

export function buildMetricasAntiguedad(stats) {
  const rows = [];
  // Cada etapa lleva su propio set de buckets (Bloque 4 — umbrales SLA
  // distintos por flujo). Antes los buckets eran fijos (0-15/16-30/...);
  // ahora vienen en stats.buckets_X como [{ key, label, ... }], y la
  // exportación los recorre dinámicamente.
  const etapas = [
    { name: 'Sin presupuesto → Con presupuesto', buckets: stats.aging_presupuesto, cfg: stats.buckets_presupuesto, comp: stats.compliance_presupuesto, total: stats.totalSinPresupuesto },
    { name: 'Solicitud → RMA generada',          buckets: stats.aging_solicitud,   cfg: stats.buckets_solicitud,   comp: stats.compliance_solicitud,    total: stats.totalEnRmaSolicitada },
    { name: 'RMA generada → OC generada',        buckets: stats.aging_rma,         cfg: stats.buckets_rma,         comp: stats.compliance_rma,          total: stats.totalEnRmaGenerada }
  ];
  etapas.forEach(e => {
    rows.push({ Etapa: e.name, '': '— Buckets de antigüedad —', Valor: '', Cumple: '' });
    rows.push({ Etapa: e.name, '': 'Total evaluadas', Valor: e.total, Cumple: '' });
    // Recorrer los buckets configurados para esta etapa, no una lista fija.
    (e.cfg || []).forEach(b => {
      rows.push({ Etapa: e.name, '': b.label, Valor: e.buckets[b.key] || 0, Cumple: '' });
    });
    rows.push({ Etapa: e.name, '': '— Cumplimiento —', Valor: '', Cumple: '' });
    e.comp.forEach(c => {
      rows.push({
        Etapa:  e.name,
        '':     c.label + ' (obj. ' + c.target + ')',
        Valor:  c.actual.toFixed(1) + '%',
        Cumple: c.pass ? '✓ Cumple' : '✗ No cumple'
      });
    });
  });
  return rows;
}

export function buildPorArea(tasks) {
  const map = {};
  tasks.forEach(t => {
    if (!map[t.area]) map[t.area] = { total: 0, activas: 0, finalizadas: 0, paradaDePlanta: 0, alta: 0 };
    map[t.area].total++;
    if (t.section === 'finalizadas') map[t.area].finalizadas++;
    else                             map[t.area].activas++;
    if (t.paradaDePlanta)            map[t.area].paradaDePlanta++;
    if (t.prioridad === 'Alta')      map[t.area].alta++;
  });
  return Object.entries(map).map(([area, v]) => ({
    'Área':              area,
    'Total':             v.total,
    'Activas':           v.activas,
    'Finalizadas':       v.finalizadas,
    '% cierre':          v.total > 0 ? Math.round((v.finalizadas / v.total) * 100) + '%' : '0%',
    'Parada de planta':  v.paradaDePlanta,
    'Alta prioridad':    v.alta
  })).sort((a, b) => b.Total - a.Total);
}

export function buildPorProveedor(stats) {
  return stats.proveedores.map(p => ({
    'Proveedor':          p.name,
    'Total solicitudes':  p.count
  }));
}

export function buildPorSolicitante(stats) {
  return stats.solicitantes.map(s => ({
    'Solicitante':        s.name,
    'Total solicitudes':  s.count
  }));
}
