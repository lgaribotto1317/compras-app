import { uid } from './helpers';

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

// Datos de ejemplo para el botón "Cargar ejemplos" del EmptyState.
// Se elimina o se mueve a un fixture de testing en Vuelta 2 (Supabase tendrá
// un script de seed separado).
export const SAMPLE_TASKS = [
  // RMA SOLICITADA — sin presupuesto
  {
    id: uid(), numero: '#000001',
    name: 'Filtro carbón activado', solicitante: 'Leo Garibotto', area: 'Mantenimiento',
    descripcionDetallada: 'Reposición de filtro de carbón activado para sistema de tratamiento de efluentes',
    paradaDePlanta: true, auditoriaInspeccion: false, proveedor: 'Casiba', prioridad: 'Alta',
    tienePresupuesto: false, presupuestadaAt: null,
    rmaNumber: null, ocNumber: null, monto: null, fechaCierre: null, observaciones: null,
    attachments: [],
    section: 'rma_solicitada', completed: false, createdAt: daysAgo(1), updatedAt: daysAgo(1),
    history: [{ at: daysAgo(1), action: 'creada', section: 'rma_solicitada' }]
  },
  {
    id: uid(), numero: '#000002',
    name: 'EPP guantes nitrilo', solicitante: 'Sergio Gallego', area: 'Pañol',
    descripcionDetallada: '50 cajas de guantes de nitrilo talle M para sala de envasado',
    paradaDePlanta: false, auditoriaInspeccion: false, proveedor: 'Distrisalud', prioridad: 'Media',
    tienePresupuesto: false, presupuestadaAt: null,
    rmaNumber: null, ocNumber: null, monto: null, fechaCierre: null, observaciones: null,
    attachments: [],
    section: 'rma_solicitada', completed: false, createdAt: daysAgo(8), updatedAt: daysAgo(8),
    history: [{ at: daysAgo(8), action: 'creada', section: 'rma_solicitada' }]
  },
  // RMA SOLICITADA — con presupuesto
  {
    id: uid(), numero: '#000003',
    name: 'Sensores ópticos línea 2', solicitante: 'María Pérez', area: 'Mantenimiento',
    descripcionDetallada: '4 sensores ópticos para línea de envasado 2',
    paradaDePlanta: false, auditoriaInspeccion: false, proveedor: 'Festo', prioridad: 'Media',
    tienePresupuesto: true, presupuestadaAt: daysAgo(1),
    rmaNumber: null, ocNumber: null, monto: null, fechaCierre: null, observaciones: null,
    attachments: [],
    section: 'rma_solicitada', completed: false, createdAt: daysAgo(3), updatedAt: daysAgo(1),
    history: [
      { at: daysAgo(3), action: 'creada', section: 'rma_solicitada' },
      { at: daysAgo(1), action: 'presupuesto cargado', section: 'rma_solicitada' }
    ]
  },
  {
    id: uid(), numero: '#000004',
    name: 'Calibración balanzas', solicitante: 'Ana Rodríguez', area: 'Mantenimiento',
    descripcionDetallada: 'Calibración anual de balanzas de laboratorio para auditoría ANMAT',
    paradaDePlanta: false, auditoriaInspeccion: true, proveedor: 'Metrología SA', prioridad: 'Alta',
    tienePresupuesto: true, presupuestadaAt: daysAgo(2),
    rmaNumber: null, ocNumber: null, monto: null, fechaCierre: null, observaciones: null,
    attachments: [],
    section: 'rma_solicitada', completed: false, createdAt: daysAgo(2), updatedAt: daysAgo(2),
    history: [{ at: daysAgo(2), action: 'creada con presupuesto', section: 'rma_solicitada' }]
  },
  // RMA GENERADA
  {
    id: uid(), numero: '#000005',
    name: 'Bombas centrífugas', solicitante: 'Carlos López', area: 'Mantenimiento',
    descripcionDetallada: '2 bombas centrífugas para circuito de refrigeración',
    paradaDePlanta: true, auditoriaInspeccion: false, proveedor: 'Grundfos', prioridad: 'Alta',
    tienePresupuesto: true, presupuestadaAt: daysAgo(10),
    rmaNumber: '20260034', ocNumber: null, monto: null, fechaCierre: null, observaciones: null,
    attachments: [],
    section: 'rma_generada', completed: false, createdAt: daysAgo(12), updatedAt: daysAgo(7),
    history: [
      { at: daysAgo(12), action: 'creada', section: 'rma_solicitada' },
      { at: daysAgo(10), action: 'presupuesto cargado', section: 'rma_solicitada' },
      { at: daysAgo(7), action: 'Generar RMA', from: 'rma_solicitada', to: 'rma_generada', values: { rmaNumber: '20260034' } }
    ]
  },
  {
    id: uid(), numero: '#000006',
    name: 'Repuestos compresor', solicitante: 'Juan Alasia', area: 'Mantenimiento',
    descripcionDetallada: 'Kit de repuestos para compresor SACB-002',
    paradaDePlanta: false, auditoriaInspeccion: false, proveedor: 'SACB', prioridad: 'Media',
    tienePresupuesto: true, presupuestadaAt: daysAgo(18),
    rmaNumber: '20260033', ocNumber: null, monto: null, fechaCierre: null, observaciones: null,
    attachments: [],
    section: 'rma_generada', completed: false, createdAt: daysAgo(20), updatedAt: daysAgo(5),
    history: [
      { at: daysAgo(20), action: 'creada', section: 'rma_solicitada' },
      { at: daysAgo(18), action: 'presupuesto cargado', section: 'rma_solicitada' },
      { at: daysAgo(5), action: 'Generar RMA', from: 'rma_solicitada', to: 'rma_generada', values: { rmaNumber: '20260033' } }
    ]
  },
  // OC GENERADA
  {
    id: uid(), numero: '#000007',
    name: 'Sensores y rodamientos línea 3', solicitante: 'Juan Alasia', area: 'Mantenimiento',
    descripcionDetallada: 'Sensores y rodamientos urgentes para línea 3',
    paradaDePlanta: false, auditoriaInspeccion: false, proveedor: 'Gumma', prioridad: 'Alta',
    tienePresupuesto: true, presupuestadaAt: daysAgo(14),
    rmaNumber: '20260021', ocNumber: '20260098', monto: '125000', fechaCierre: null, observaciones: null,
    attachments: [],
    section: 'oc_generada', completed: false, createdAt: daysAgo(15), updatedAt: daysAgo(4),
    history: [
      { at: daysAgo(15), action: 'creada', section: 'rma_solicitada' },
      { at: daysAgo(14), action: 'presupuesto cargado', section: 'rma_solicitada' },
      { at: daysAgo(10), action: 'Generar RMA', from: 'rma_solicitada', to: 'rma_generada', values: { rmaNumber: '20260021' } },
      { at: daysAgo(4),  action: 'Generar OC',  from: 'rma_generada',   to: 'oc_generada',  values: { ocNumber: '20260098', monto: '125000' } }
    ]
  },
  {
    id: uid(), numero: '#000008',
    name: 'Materia prima Q1', solicitante: 'Pablo Méndez', area: 'Pañol',
    descripcionDetallada: 'Lote MP enero 2026 - insumos productivos',
    paradaDePlanta: false, auditoriaInspeccion: false, proveedor: 'Distribuidora Sur', prioridad: 'Media',
    tienePresupuesto: true, presupuestadaAt: daysAgo(19),
    rmaNumber: '20260019', ocNumber: '20260091', monto: '430000', fechaCierre: null, observaciones: null,
    attachments: [],
    section: 'oc_generada', completed: false, createdAt: daysAgo(20), updatedAt: daysAgo(8),
    history: [
      { at: daysAgo(20), action: 'creada', section: 'rma_solicitada' },
      { at: daysAgo(19), action: 'presupuesto cargado', section: 'rma_solicitada' },
      { at: daysAgo(15), action: 'Generar RMA', from: 'rma_solicitada', to: 'rma_generada', values: { rmaNumber: '20260019' } },
      { at: daysAgo(8),  action: 'Generar OC',  from: 'rma_generada',   to: 'oc_generada',  values: { ocNumber: '20260091', monto: '430000' } }
    ]
  },
  // FINALIZADAS
  {
    id: uid(), numero: '#000009',
    name: 'Lubricantes industriales', solicitante: 'Leo Garibotto', area: 'Mantenimiento',
    descripcionDetallada: 'Pedido trimestral de aceites y grasas industriales',
    paradaDePlanta: false, auditoriaInspeccion: false, proveedor: 'Shell', prioridad: 'Baja',
    tienePresupuesto: true, presupuestadaAt: daysAgo(26),
    rmaNumber: '20260015', ocNumber: '20260084', monto: '78000',
    fechaCierre: '2026-04-15', observaciones: 'Recepción conforme',
    attachments: [],
    section: 'finalizadas', completed: true, createdAt: daysAgo(28), updatedAt: daysAgo(2),
    history: [
      { at: daysAgo(28), action: 'creada', section: 'rma_solicitada' },
      { at: daysAgo(26), action: 'presupuesto cargado', section: 'rma_solicitada' },
      { at: daysAgo(22), action: 'Generar RMA',    from: 'rma_solicitada', to: 'rma_generada', values: { rmaNumber: '20260015' } },
      { at: daysAgo(14), action: 'Generar OC',     from: 'rma_generada',   to: 'oc_generada',  values: { ocNumber: '20260084', monto: '78000' } },
      { at: daysAgo(2),  action: 'Finalizar compra', from: 'oc_generada', to: 'finalizadas', values: { fechaCierre: '2026-04-15', observaciones: 'Recepción conforme' } }
    ]
  },
  {
    id: uid(), numero: '#000010',
    name: 'Tóner impresoras', solicitante: 'Ana Rodríguez', area: 'Facilities',
    descripcionDetallada: 'Cartuchos HP para impresoras de oficina',
    paradaDePlanta: false, auditoriaInspeccion: false, proveedor: 'Officenet', prioridad: 'Baja',
    tienePresupuesto: true, presupuestadaAt: daysAgo(34),
    rmaNumber: '20260012', ocNumber: '20260080', monto: '32000',
    fechaCierre: '2026-04-10', observaciones: 'Entrega completa',
    attachments: [],
    section: 'finalizadas', completed: true, createdAt: daysAgo(35), updatedAt: daysAgo(7),
    history: [
      { at: daysAgo(35), action: 'creada', section: 'rma_solicitada' },
      { at: daysAgo(34), action: 'presupuesto cargado', section: 'rma_solicitada' },
      { at: daysAgo(30), action: 'Generar RMA',    from: 'rma_solicitada', to: 'rma_generada', values: { rmaNumber: '20260012' } },
      { at: daysAgo(20), action: 'Generar OC',     from: 'rma_generada',   to: 'oc_generada',  values: { ocNumber: '20260080', monto: '32000' } },
      { at: daysAgo(7),  action: 'Finalizar compra', from: 'oc_generada', to: 'finalizadas', values: { fechaCierre: '2026-04-10', observaciones: 'Entrega completa' } }
    ]
  },
  {
    id: uid(), numero: '#000011',
    name: 'Válvulas neumáticas', solicitante: 'Carlos López', area: 'Mantenimiento',
    descripcionDetallada: '6 válvulas para línea 1 - reemplazo programado',
    paradaDePlanta: true, auditoriaInspeccion: false, proveedor: 'Festo', prioridad: 'Alta',
    tienePresupuesto: true, presupuestadaAt: daysAgo(43),
    rmaNumber: '20260008', ocNumber: '20260072', monto: '215000',
    fechaCierre: '2026-03-28', observaciones: 'Instaladas y operativas',
    attachments: [],
    section: 'finalizadas', completed: true, createdAt: daysAgo(45), updatedAt: daysAgo(15),
    history: [
      { at: daysAgo(45), action: 'creada', section: 'rma_solicitada' },
      { at: daysAgo(43), action: 'presupuesto cargado', section: 'rma_solicitada' },
      { at: daysAgo(40), action: 'Generar RMA',    from: 'rma_solicitada', to: 'rma_generada', values: { rmaNumber: '20260008' } },
      { at: daysAgo(32), action: 'Generar OC',     from: 'rma_generada',   to: 'oc_generada',  values: { ocNumber: '20260072', monto: '215000' } },
      { at: daysAgo(15), action: 'Finalizar compra', from: 'oc_generada', to: 'finalizadas', values: { fechaCierre: '2026-03-28', observaciones: 'Instaladas y operativas' } }
    ]
  }
];
