import { AlertTriangle, ShieldCheck, Flame, Clock } from 'lucide-react';
import { SECTIONS, GROUP_KEY_BY_SECTION } from '../../lib/constants';

// ─── CÁLCULO DE ESTADÍSTICAS ──────────────────────────────────────
// Función pura: recibe el array de solicitudes, devuelve el objeto stats.
// Sin side effects, sin JSX. Importable desde Dashboard y ExportarView.
//
// Umbrales SLA (para compliance):
//   0-15 días  → > 50% (bueno)
//   16-30 días → < 30%
//   31-60 días → < 15%
//   >60 días   → < 5%
//   <30 días   → > 80% (acumulado)

export function calculateStats(tasks) {
  // ─── DEDUPE POR GRUPO (CONSOLIDACIÓN) ─────────────────────────────
  // Una fila por grupo según la group-key de su sección:
  //   rma_generada → rmaNumber,  rma_valorizada/oc_generada/finalizadas → cma/ocNumber
  // Las filas que comparten número avanzaron juntas (misma fecha de evento),
  // así que el representante conserva las fechas del grupo. Sin número (o
  // rma_solicitada, cuya group-key es null) cada fila cuenta como su propio grupo.
  function dedupeByGroup(rows) {
    const seen = new Map();
    for (const t of rows) {
      const gk  = GROUP_KEY_BY_SECTION[t.section];
      const val = gk ? t[gk] : null;
      const key = (val == null || val === '') ? `__id_${t.id}` : `${t.section}:${gk}:${val}`;
      if (!seen.has(key)) seen.set(key, t);
    }
    return [...seen.values()];
  }

  const totales        = tasks.length;
  const enCurso        = tasks.filter(t => t.section !== 'finalizadas').length;
  const finalizadas    = tasks.filter(t => t.section === 'finalizadas').length;
  const tasaFinalizacion = totales > 0 ? Math.round((finalizadas / totales) * 100) : 0;
  const altaPrioridad  = tasks.filter(t => t.prioridad === 'Alta' && t.section !== 'finalizadas').length;
  const paradaPlanta   = tasks.filter(t => t.paradaDePlanta && t.section !== 'finalizadas').length;
  const auditoria      = tasks.filter(t => t.auditoriaInspeccion && t.section !== 'finalizadas').length;

  // Conteo por sección
  const porSeccion = {};
  SECTIONS.forEach(s => { porSeccion[s.id] = 0; });
  tasks.forEach(t => { if (porSeccion[t.section] !== undefined) porSeccion[t.section]++; });

  // Tiempo promedio de ciclo (creación → finalización)
  const finalizadasConHist = tasks.filter(t => t.section === 'finalizadas' && t.history?.length > 0);
  let tiempoPromedioCierre = null;
  if (finalizadasConHist.length > 0) {
    const dias = finalizadasConHist
      .map(t => {
        const fin = t.history.find(h => h.to === 'finalizadas');
        if (!fin) return null;
        return (new Date(fin.at) - new Date(t.createdAt)) / 86400000;
      })
      .filter(d => d !== null);
    if (dias.length > 0) {
      tiempoPromedioCierre = Math.round(dias.reduce((a, b) => a + b, 0) / dias.length);
    }
  }

  // Por prioridad (solo activas)
  const prioMap = { Alta: 0, Media: 0, Baja: 0 };
  tasks.filter(t => t.section !== 'finalizadas').forEach(t => {
    if (t.prioridad && prioMap[t.prioridad] !== undefined) prioMap[t.prioridad]++;
  });
  const totalPrio = Object.values(prioMap).reduce((a, b) => a + b, 0);

  // Top proveedores — cuenta proveedorAdjudicado (a quién se le emitió OC),
  // no el preferido. Solo solicitudes que pasaron por "Generar OC" lo tienen.
  // DISTINCT por ocNumber: una OC consolidada (varias filas, mismo número) a
  // un proveedor cuenta como 1 OC, no como N. Filas sin ocNumber (no debería
  // pasar si hay proveedorAdjudicado) caen a su id para no perderlas.
  const provSeen = {};
  tasks.forEach(t => {
    if (!t.proveedorAdjudicado) return;
    if (!provSeen[t.proveedorAdjudicado]) provSeen[t.proveedorAdjudicado] = new Set();
    provSeen[t.proveedorAdjudicado].add(t.ocNumber || `__id_${t.id}`);
  });
  const proveedores = Object.entries(provSeen)
    .map(([name, set]) => ({ name, count: set.size }))
    .sort((a, b) => b.count - a.count);

  // Top solicitantes
  const solMap = {};
  tasks.forEach(t => {
    if (!t.solicitante) return;
    solMap[t.solicitante] = (solMap[t.solicitante] || 0) + 1;
  });
  const solicitantes = Object.entries(solMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Actividad últimos 30 días
  const actividad30d = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const day    = new Date(hoy);
    day.setDate(day.getDate() - i);
    const dayEnd = new Date(day);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const creadas = tasks.filter(t => {
      const c = new Date(t.createdAt);
      return c >= day && c < dayEnd;
    }).length;

    const cerradas = tasks.filter(t => {
      if (!t.history) return false;
      const fin = t.history.find(h => h.to === 'finalizadas');
      if (!fin) return false;
      const f = new Date(fin.at);
      return f >= day && f < dayEnd;
    }).length;

    actividad30d.push({
      date:    day.toISOString().slice(0, 10),
      label:   day.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
      creadas,
      cerradas
    });
  }

  // ─── ANTIGÜEDAD POR ETAPA ─────────────────────────────────────────
  // Cada flujo tiene su propio set de buckets y umbrales SLA.
  // Los buckets vienen como [{ key, label, max, color }, ...] donde `max`
  // es el límite superior inclusivo en días, o null para "infinito" (último bucket).
  // El orden importa: se evalúa en orden y la primera coincidencia gana.
  //
  // Para mantener `StageAging` flexible, devolvemos para cada flujo:
  //   - aging_X: { [key]: count } (los counts por bucket)
  //   - buckets_X: el array de configuración (la card lo usa para renderizar
  //                las filas con los labels y colores correctos)
  //   - compliance_X: filas con label/target/actual/threshold/op/pass
  //   - totalX: cantidad total
  const ahora = Date.now();

  function aging(buckets, items, getRefDate = (t) => new Date(t.createdAt)) {
    const counts = Object.fromEntries(buckets.map(b => [b.key, 0]));
    items.forEach(t => {
      const dias = Math.floor((ahora - getRefDate(t)) / 86400000);
      const hit  = buckets.find(b => b.max == null || dias <= b.max);
      if (hit) counts[hit.key]++;
    });
    return counts;
  }

  // ── Flujo 1: Sin presupuesto → Con presupuesto ────────────────────
  // Buckets: 0-7, 8-15, >15. Solo aplican a las que están en
  // rma_solicitada Y sin presupuesto.
  const buckets_presupuesto = [
    { key: '0-7',   label: '0-7 días',   max: 7,    color: 'bg-emerald-500' },
    { key: '8-15',  label: '8-15 días',  max: 15,   color: 'bg-sky-500'     },
    { key: '15+',   label: '> 15 días',  max: null, color: 'bg-red-600'     }
  ];
  const sinPresupuesto    = tasks.filter(t => t.section === 'rma_solicitada' && !t.tienePresupuesto);
  const aging_presupuesto = aging(buckets_presupuesto, sinPresupuesto);

  // Compliance del flujo de presupuesto.
  // Cambios respecto del modelo anterior:
  //   - 0-7 días: > 80% (umbral nuevo del usuario)
  //   - 0-15 días acumulado: > 90% (al día 15 casi todo debe estar presupuestado)
  //   - > 15 días: < 5%
  function buildComplianceP(buckets, total) {
    const pct = (n) => total > 0 ? (n / total) * 100 : 0;
    return [
      { key: '0-7',    label: '0-7 días',   target: '> 80%', actual: pct(buckets['0-7']),                         threshold: 80, op: 'gt' },
      { key: '0-15',   label: '0-15 días',  target: '> 90%', actual: pct(buckets['0-7'] + buckets['8-15']),       threshold: 90, op: 'gt' },
      { key: '15+',    label: '> 15 días',  target: '< 5%',  actual: pct(buckets['15+']),                         threshold: 5,  op: 'lt' }
    ].map(c => ({ ...c, pass: c.op === 'gt' ? c.actual > c.threshold : c.actual < c.threshold }));
  }
  const compliance_presupuesto = buildComplianceP(aging_presupuesto, sinPresupuesto.length);

  // ── Flujo 2: Solicitud → RMA generada ─────────────────────────────
  // Modelo binario: % de solicitudes en rma_solicitada con menos de 7
  // días desde su creación. Umbral 100% (cualquier solicitud >=7d
  // hace fallar la métrica).
  const enRmaSolicitada = tasks.filter(t => t.section === 'rma_solicitada');
  const buckets_solicitud = [
    { key: '<7',  label: '< 7 días',  max: 6,    color: 'bg-emerald-500' },
    { key: '7+',  label: '≥ 7 días',  max: null, color: 'bg-red-600'     }
  ];
  const aging_solicitud = aging(buckets_solicitud, enRmaSolicitada);

  function buildComplianceS(buckets, total) {
    const pct = (n) => total > 0 ? (n / total) * 100 : 0;
    return [
      // El umbral "100%" se evalúa como >= 100. Usamos op='ge' para "mayor o igual".
      // Cualquier solicitud que cruce los 7 días tira la métrica a < 100%.
      { key: '<7', label: '< 7 días', target: '= 100%', actual: pct(buckets['<7']), threshold: 100, op: 'ge' }
    ].map(c => ({ ...c, pass: c.op === 'ge' ? c.actual >= c.threshold : c.actual === c.threshold }));
  }
  const compliance_solicitud = buildComplianceS(aging_solicitud, enRmaSolicitada.length);

  // ── Flujo 3: RMA esperando OC → OC generada ───────────────────────
  // "Esperando OC" = solicitudes en rma_generada O rma_valorizada (ambas
  // ya tienen RMA pero todavía no OC). Buckets: 0-15, 16-30, 31-60, >60.
  // Mide días desde el evento "Generar RMA". Si no hay evento, usa createdAt.
  const buckets_rma = [
    { key: '0-15',  label: '0-15 días',  max: 15,   color: 'bg-emerald-500' },
    { key: '16-30', label: '16-30 días', max: 30,   color: 'bg-sky-500'     },
    { key: '31-60', label: '31-60 días', max: 60,   color: 'bg-orange-500'  },
    { key: '60+',   label: '> 60 días',  max: null, color: 'bg-red-600'     }
  ];
  const enRmaGenerada = tasks.filter(t => t.section === 'rma_generada' || t.section === 'rma_valorizada');
  // DISTINCT por grupo: "esperando OC" cuenta RMAs (en rma_generada) y CMAs
  // (en rma_valorizada), no solicitudes. Una RMA/CMA consolidada = 1 cosa
  // esperando OC. Las filas del grupo comparten el evento Generar RMA.
  const enRmaGeneradaGroups = dedupeByGroup(enRmaGenerada);
  const refDateRma = (t) => {
    const evRma = (t.history || []).find(h => h.to === 'rma_generada');
    return evRma ? new Date(evRma.at) : new Date(t.createdAt);
  };
  const aging_rma = aging(buckets_rma, enRmaGeneradaGroups, refDateRma);

  // Resumen de días ESPERANDO OC (encabezado de la card, espejo abierto del
  // lead-time cerrado que se eliminó). Días = hoy − evento Generar RMA, por
  // grupo distinto. Sin grupos → todo null.
  const diasEspera = enRmaGeneradaGroups
    .map(t => Math.floor((ahora - refDateRma(t)) / 86400000))
    .filter(d => d >= 0)
    .sort((a, b) => a - b);
  const nEspera = diasEspera.length;
  const r1e = (x) => Math.round(x * 10) / 10;
  const esperaRmaOc = nEspera === 0
    ? { n: 0, promedio: null, mediana: null, min: null, max: null }
    : {
        n: nEspera,
        promedio: r1e(diasEspera.reduce((a, b) => a + b, 0) / nEspera),
        mediana:  r1e(nEspera % 2 ? diasEspera[(nEspera - 1) / 2]
                                  : (diasEspera[nEspera / 2 - 1] + diasEspera[nEspera / 2]) / 2),
        min: diasEspera[0],
        max: diasEspera[nEspera - 1]
      };

  function buildComplianceR(buckets, total) {
    const pct = (n) => total > 0 ? (n / total) * 100 : 0;
    return [
      { key: '0-15',  label: '0-15 días',  target: '> 75%', actual: pct(buckets['0-15']),  threshold: 75, op: 'gt' },
      { key: '16-30', label: '16-30 días', target: '< 30%', actual: pct(buckets['16-30']), threshold: 30, op: 'lt' },
      { key: '31-60', label: '31-60 días', target: '< 15%', actual: pct(buckets['31-60']), threshold: 15, op: 'lt' },
      { key: '60+',   label: '> 60 días',  target: '< 5%',  actual: pct(buckets['60+']),   threshold: 5,  op: 'lt' }
    ].map(c => ({ ...c, pass: c.op === 'gt' ? c.actual > c.threshold : c.actual < c.threshold }));
  }
  const compliance_rma = buildComplianceR(aging_rma, enRmaGeneradaGroups.length);

  // Aging global (todas las activas) — usado en alertas y en el cálculo
  // de envejecimiento general. Mantiene los buckets viejos (0-15/16-30/
  // 31-60/60+) porque no es un flujo específico sino una mirada agregada.
  const activas = tasks.filter(t => t.section !== 'finalizadas');
  const aging_global = { '0-15': 0, '16-30': 0, '31-60': 0, '60+': 0 };
  activas.forEach(t => {
    const dias = Math.floor((ahora - new Date(t.createdAt)) / 86400000);
    if      (dias <= 15) aging_global['0-15']++;
    else if (dias <= 30) aging_global['16-30']++;
    else if (dias <= 60) aging_global['31-60']++;
    else                 aging_global['60+']++;
  });
  const totalActivas = activas.length;

  // Alertas: paradas de planta, auditoría, prioridad alta antigua, >30d sin cerrar
  const alertas = [];
  tasks.filter(t => t.section !== 'finalizadas').forEach(t => {
    const dias = Math.floor((ahora - new Date(t.createdAt)) / 86400000);
    if (t.paradaDePlanta) {
      alertas.push({ task: t, type: 'critical', label: 'Parada de planta',          icon: AlertTriangle, dias });
    } else if (t.auditoriaInspeccion && dias > 7) {
      alertas.push({ task: t, type: 'critical', label: `Auditoría · ${dias}d`,      icon: ShieldCheck,   dias });
    } else if (t.prioridad === 'Alta' && dias > 7) {
      alertas.push({ task: t, type: 'warn',     label: `Alta · ${dias}d en proceso`, icon: Flame,        dias });
    } else if (dias > 30) {
      alertas.push({ task: t, type: 'warn',     label: `${dias}d sin cerrar`,        icon: Clock,        dias });
    }
  });
  alertas.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'critical' ? -1 : 1;
    return b.dias - a.dias;
  });

  // Actividad reciente (últimos 8 eventos de historial)
  const eventos = [];
  tasks.forEach(t => {
    (t.history || []).forEach(h => eventos.push({ task: t, event: h, at: h.at }));
  });
  eventos.sort((a, b) => new Date(b.at) - new Date(a.at));
  const actividadReciente = eventos.slice(0, 8);

  // ─── BLOQUE 4: CANCELACIONES ─────────────────────────────────────
  // Importante: `tasks` puede o no incluir canceladas, dependiendo del
  // filtro `includeCancelled` del modal. Las stats de cancelación tienen
  // sentido como métrica histórica, así que las contamos siempre que
  // estén presentes. Si el usuario está mirando el Dashboard sin el
  // toggle activo, NO va a ver canceladas en los KPIs — eso es esperable
  // y se documenta en el banner del Dashboard.
  const canceladas       = tasks.filter(t => t.cancelledAt).length;
  const tasaCancelacion  = totales > 0 ? Math.round((canceladas / totales) * 100) : 0;

  // Top motivos: agrupamos por motivo normalizado (trim + lowercase para
  // que "Proveedor sin stock" y "proveedor sin stock" cuenten igual).
  // Mostramos el motivo "original" del último que apareció, no normalizado,
  // para que se lea natural.
  const motivosMap = new Map();
  tasks.forEach(t => {
    if (!t.cancellationReason) return;
    const key  = t.cancellationReason.trim().toLowerCase();
    const prev = motivosMap.get(key);
    motivosMap.set(key, { motivo: t.cancellationReason.trim(), count: (prev?.count || 0) + 1 });
  });
  const motivosTop = Array.from(motivosMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ─── EVOLUCIÓN SEMANAL DEL BACKLOG (RMA SIN OC, POR ANTIGÜEDAD) ────
  // Reconstrucción histórica: para cada sábado desde la RMA más antigua
  // hasta hoy, cuántas solicitudes ya habían generado RMA pero todavía
  // NO tenían OC en esa fecha, clasificadas por antigüedad (días desde
  // "Generar RMA" hasta el corte). Es la evolución del backlog, NO el
  // lead-time de cierre.
  // Excluye canceladas/eliminadas (mira estado actual; las históricas
  // importadas no tienen cancelaciones, así que no afecta el resultado).
  function buildBacklogSemanal() {
    const evDate = (t, toSection) => {
      const ev = (t.history || []).find(h => h.to === toSection);
      return ev ? new Date(ev.at) : null;
    };
    // DISTINCT por RMA: el backlog es "RMAs sin OC", no solicitudes. Las filas
    // que comparten rmaNumber avanzaron juntas (mismas fechas tRMA/tOC), así
    // que dedupear por número da el conteo de RMAs distintas. Las que no tienen
    // rmaNumber (rma_solicitada) caen a su id y luego se filtran por tRMA null.
    const dedup = new Map();
    tasks.filter(t => !t.cancelledAt && !t.deletedAt).forEach(t => {
      const key = t.rmaNumber ? `rma:${t.rmaNumber}` : `id:${t.id}`;
      if (!dedup.has(key)) dedup.set(key, t);
    });
    const cand = [...dedup.values()]
      .map(t => {
        const tRMA = evDate(t, 'rma_generada')
          || (t.section !== 'rma_solicitada' ? new Date(t.createdAt) : null);
        const tOC = evDate(t, 'oc_generada');
        return { tRMA, tOC };
      })
      .filter(x => x.tRMA);
    if (cand.length === 0) return [];

    const toSaturday = (d) => {
      const x = new Date(d); x.setHours(0, 0, 0, 0);
      const diff = (x.getDay() - 6 + 7) % 7; // días desde el último sábado
      x.setDate(x.getDate() - diff);
      return x;
    };
    const start  = toSaturday(new Date(Math.min(...cand.map(x => x.tRMA.getTime()))));
    const endHoy = toSaturday(new Date());
    const semanas = [];
    for (let w = new Date(start); w <= endHoy; w.setDate(w.getDate() + 7)) {
      const corte  = new Date(w);
      const counts = { '0-15': 0, '16-30': 0, '31-60': 0, '60+': 0 };
      cand.forEach(x => {
        if (x.tRMA <= corte && (!x.tOC || x.tOC > corte)) {
          const dias = Math.floor((corte - x.tRMA) / 86400000);
          if      (dias <= 15) counts['0-15']++;
          else if (dias <= 30) counts['16-30']++;
          else if (dias <= 60) counts['31-60']++;
          else                 counts['60+']++;
        }
      });
      semanas.push({
        semana: corte.toISOString().slice(0, 10),
        label:  corte.toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' }),
        ...counts,
        total: counts['0-15'] + counts['16-30'] + counts['31-60'] + counts['60+']
      });
    }
    return semanas;
  }
  const backlogSemanal = buildBacklogSemanal();

  return {
    totales, enCurso, finalizadas, tasaFinalizacion,
    altaPrioridad, paradaPlanta, auditoria,
    porSeccion, tiempoPromedioCierre,
    prioMap, totalPrio,
    proveedores, solicitantes,
    actividad30d,
    // Aging global (usado por algunas vistas / alertas)
    aging: aging_global, totalActivas,
    // Buckets + compliance por flujo (Bloque 4 — umbrales SLA actualizados)
    aging_solicitud,    compliance_solicitud,    buckets_solicitud,    totalEnRmaSolicitada: enRmaSolicitada.length,
    aging_rma,          compliance_rma,          buckets_rma,          totalEnRmaGenerada:   enRmaGeneradaGroups.length,
    // Resumen de días esperando OC (encabezado de la card RMA→OC)
    esperaRmaOc,
    aging_presupuesto,  compliance_presupuesto,  buckets_presupuesto,  totalSinPresupuesto:  sinPresupuesto.length,
    alertas, actividadReciente,
    // Evolución semanal del backlog RMA sin OC (gráfico apilado)
    backlogSemanal,
    // Cancelaciones
    canceladas, tasaCancelacion, motivosTop
  };
}
