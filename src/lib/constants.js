import { Package, Receipt, DollarSign, ShoppingCart, CheckCircle2 } from 'lucide-react';

// ─── SECCIONES DEL FLUJO ──────────────────────────────────────────
export const SECTIONS = [
  {
    id: 'rma_solicitada',
    name: 'RMA solicitada',
    short: 'Solicitud',
    icon: Package,
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-900',
    chip: 'bg-orange-50 text-orange-800 border border-orange-200',
    dot: 'bg-orange-500',
    btn: 'bg-orange-600 hover:bg-orange-700',
    bar: 'bg-orange-500',
    accent: 'orange'
  },
  {
    id: 'rma_generada',
    name: 'RMA generada',
    short: 'RMA',
    icon: Receipt,
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-900',
    chip: 'bg-sky-50 text-sky-800 border border-sky-200',
    dot: 'bg-sky-500',
    btn: 'bg-sky-600 hover:bg-sky-700',
    bar: 'bg-sky-500',
    accent: 'sky'
  },
  {
    id: 'rma_valorizada',
    name: 'RMA valorizada',
    short: 'Valorizada',
    icon: DollarSign,
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-900',
    chip: 'bg-teal-50 text-teal-800 border border-teal-200',
    dot: 'bg-teal-500',
    btn: 'bg-teal-600 hover:bg-teal-700',
    bar: 'bg-teal-500',
    accent: 'teal'
  },
  {
    id: 'oc_generada',
    name: 'OC generada',
    short: 'OC',
    icon: ShoppingCart,
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-900',
    chip: 'bg-violet-50 text-violet-800 border border-violet-200',
    dot: 'bg-violet-500',
    btn: 'bg-violet-600 hover:bg-violet-700',
    bar: 'bg-violet-500',
    accent: 'violet'
  },
  {
    id: 'finalizadas',
    name: 'OC finalizada',
    short: 'Finalizada',
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
    chip: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    dot: 'bg-emerald-500',
    btn: 'bg-emerald-600 hover:bg-emerald-700',
    bar: 'bg-emerald-500',
    accent: 'emerald'
  }
];

export const SECTION_ORDER = SECTIONS.map(s => s.id);
export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map(s => [s.id, s]));

// ─── ÁREAS ────────────────────────────────────────────────────────
export const AREAS = ['Mantenimiento', 'Facilities', 'Ingeniería', 'Pañol'];

// ─── PRIORIDADES ──────────────────────────────────────────────────
export const PRIORIDADES = [
  { value: 'Alta',  dot: 'bg-red-500',    chip: 'bg-red-50 text-red-700 border-red-200',       solid: '#ef4444' },
  { value: 'Media', dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-700 border-orange-200', solid: '#f97316' },
  { value: 'Baja',  dot: 'bg-slate-400',  chip: 'bg-slate-50 text-slate-600 border-slate-200',  solid: '#94a3b8' }
];

export const PRIORIDAD_ORDER = { Alta: 0, Media: 1, Baja: 2 };

// ─── FLUJO DE PASOS ───────────────────────────────────────────────
// Define qué se pide al usuario al avanzar desde cada sección.
// Flujo: solicitada → generada → valorizada → OC generada → OC finalizada
export const FLOW_STEPS = {
  rma_solicitada: {
    next: 'rma_generada',
    label: 'Generar RMA',
    title: 'Generar número de RMA',
    subtitle: 'Cargá el número de RMA (5 dígitos)',
    fields: [
      { key: 'rmaNumber',       label: 'Número de RMA', placeholder: 'Ej: 12274', required: true, type: 'number', digits: 5 },
      { key: 'comentariosRma',  label: 'Comentarios',   placeholder: 'Información adicional sobre la RMA (opcional)', required: false, multiline: true }
    ]
  },
  rma_generada: {
    next: 'rma_valorizada',
    label: 'Valorizar RMA',
    title: 'Valorizar RMA',
    subtitle: 'Cargá el número de CMA y la valorización',
    fields: [
      { key: 'cmaNumber', label: 'Número de CMA', placeholder: 'Ej: 30145', required: true, type: 'number', digits: 5 },
      { key: 'monto',     label: 'Monto',         placeholder: 'Ej: 125000', required: true, type: 'number' }
    ]
  },
  rma_valorizada: {
    next: 'oc_generada',
    label: 'Generar OC',
    title: 'Generar Orden de Compra',
    subtitle: 'Datos de la OC emitida',
    fields: [
      { key: 'ocNumber',            label: 'Número de OC',         placeholder: 'Ej: 22338',         required: true, type: 'number', digits: 5 },
      { key: 'proveedorAdjudicado', label: 'Proveedor adjudicado', placeholder: 'Buscar proveedor por nombre o código...', required: true, widget: 'proveedor', codeKey: 'proveedorAdjudicadoCodigo' }
    ]
  },
  oc_generada: {
    next: 'finalizadas',
    label: 'Finalizar compra',
    title: 'Finalizar compra',
    subtitle: 'Confirmá el cierre de la compra',
    fields: [
      { key: 'fechaCierre',   label: 'Fecha de recepción', placeholder: 'YYYY-MM-DD',            required: false, type: 'date' },
      { key: 'observaciones', label: 'Observaciones',       placeholder: 'Estado del producto...', required: false, multiline: true }
    ]
  }
};

// ─── UNICIDAD DE IDENTIFICADORES ──────────────────────────────────
// Campos que deben ser únicos en toda la base de solicitudes.
// Para agregar un nuevo campo único, sumarlo acá — la validación
// en AdvanceModal y advanceTask lo levanta automáticamente.
export const CAMPOS_UNICOS = {
  rmaNumber: 'Número de RMA',
  cmaNumber: 'Número de CMA',
  ocNumber:  'Número de OC'
};

// ─── CONSOLIDACIÓN N→1 ────────────────────────────────────────────
// Modelo de tabla plana con número compartido (sin entidad de grupo).
// Un "grupo" es el conjunto de filas de una MISMA sección que comparten
// el valor (no nulo) del campo identificador de abajo. En rma_solicitada
// las filas son individuales (todavía no tienen número) → null.
//
//   rma_generada   → comparten rmaNumber  (varias solicitudes → 1 RMA)
//   rma_valorizada → comparten cmaNumber  (varias RMA → 1 CMA)
//   oc_generada    → comparten ocNumber   (CMA → OMA, 1:1)
//   finalizadas    → comparten ocNumber
//
// IMPORTANTE: al haber dropeado los índices únicos en Postgres
// (rma/cma/oc_number), la integridad "un número = un grupo" la sostiene
// AHORA la validación client-side en advanceTasks (ver useSolicitudes).
export const GROUP_KEY_BY_SECTION = {
  rma_solicitada: null,
  rma_generada:   'rmaNumber',
  rma_valorizada: 'cmaNumber',
  oc_generada:    'ocNumber',
  finalizadas:    'ocNumber'
};

// Secciones donde el avance FUSIONA por multi-select: se eligen varias
// cards y se les asigna UN número compartido. El resto de los avances
// son "group-aware" (mueven el grupo entero, sin elegir a otros).
//   rma_solicitada → Generar RMA : multi-select de solicitudes individuales.
//   rma_generada   → Valorizar   : multi-select de RMA (grupos) → 1 CMA.
// (Lo consume la UI en la Tanda 1b; se define acá para centralizar config.)
export const CONSOLIDA_EN = ['rma_solicitada', 'rma_generada'];

// ─── LÍMITES DE ADJUNTOS ──────────────────────────────────────────
// Bucket de Supabase Storage configurado con tope de 10MB por archivo.
// Tope global por solicitud lo dejamos en 30MB sumando todos los adjuntos
// (es un freno suave del lado del cliente, no una restricción de Supabase).
// La compresión client-side de imágenes se mantiene para reducir
// transferencia y consumo de storage (decisión documentada: GMP no exige
// preservar original sin alterar).
export const MAX_IMG_DIM       = 1280;
export const IMG_QUALITY       = 0.8;
export const MAX_FILE_SIZE     = 10 * 1024 * 1024;   // 10 MB (tope del bucket)
export const MAX_TOTAL_STORAGE = 30 * 1024 * 1024;   // 30 MB tope global por solicitud

// Nombre del bucket de Supabase Storage donde se almacenan los adjuntos.
// Privado, accedido siempre vía signed URLs (no hay URLs públicas).
export const ATTACHMENTS_BUCKET = 'attachments';

// Tiempo de validez de las signed URLs (segundos).
// - LONG: para imágenes que se renderizan en el DetailModal mientras está abierto.
//   1h es suficiente para sesiones normales; si el usuario deja el modal abierto
//   más tiempo, refrescar la página regenera URLs nuevas.
// - SHORT: para descargas de archivos no-imagen (PDF/doc/xlsx). La URL se usa
//   inmediatamente al click y no queda flotando.
export const SIGNED_URL_LONG_SEC  = 60 * 60;  // 1 hora
export const SIGNED_URL_SHORT_SEC = 60;       // 1 minuto

// ─── FUNCIONES DE USUARIO ─────────────────────────────────────────
// Valores posibles del claim `app_metadata.funcion` en el JWT.
// Sin este claim, el usuario es "solicitante" (puede crear y cancelar
// solo las solicitudes que él mismo creó).
//
// IMPORTANTE: estos valores tienen que coincidir EXACTAMENTE con los
// strings que comparan las policies RLS de Supabase (ver bloque4.sql).
// Si se agrega/renombra una función acá, también hay que tocar las
// policies. Coordinarlo igual que con AREAS y los check constraints.
export const FUNCIONES = {
  RESPONSABLE_RMA: 'responsable_rma',
  COMPRAS:         'compras'
};

// ─── REGLAS DE CANCELACIÓN ────────────────────────────────────────
// Para cada sección, qué funciones pueden cancelar una solicitud.
// El dueño (creador) siempre puede cancelar las suyas en RMA solicitada.
// El admin puede cancelar siempre, transversal.
// Si una sección no está en este mapa, nadie puede cancelar
// (caso de "finalizadas" — decisión C2).
//
// Lectura: "para cancelar una solicitud que está en X, el usuario debe
// (ser admin) OR (ser el creador AND la sección está en SOLICITANTE_PUEDE)
// OR (tener una función que esté en CANCEL_RULES[X])".
//
// El frontend usa esto en canCancel() para mostrar/ocultar el botón.
// La RLS de Supabase aplica EXACTAMENTE la misma lógica del lado servidor
// (ver UPDATE policy del bloque4.sql). El frontend es solo cosmético —
// si alguien hackea el DOM y dispara la cancelación, Supabase la rebota.
export const CANCEL_RULES = {
  rma_solicitada: [FUNCIONES.RESPONSABLE_RMA],
  rma_generada:   [FUNCIONES.RESPONSABLE_RMA, FUNCIONES.COMPRAS],
  rma_valorizada: [FUNCIONES.COMPRAS],
  oc_generada:    [FUNCIONES.COMPRAS]
  // finalizadas: NO se puede cancelar (no aparece en el mapa)
};

// Secciones desde las que el creador (solicitante) puede cancelar su
// propia solicitud. Las demás no se autocancelan: tienen que pedirlo
// a la función correspondiente.
export const SOLICITANTE_PUEDE_CANCELAR_EN = ['rma_solicitada'];

// ─── ESTADO MENSUAL MANUAL (panel "Costo" del Dashboard) ──────────
// Override hardcodeado del color de cada mes en el panel "Costo".
// PISA el cálculo automático (cohorte de OCs emitidas en el mes vs SLA).
// Keys 'YYYY-MM'. Valores válidos: 'verde' | 'rojo'.
//
// Ene–Abr 2026: NO se importan al sistema, pero se sabe cómo cerraron → rojo.
// Mayo 2026: fijo en verde por decisión del usuario.
// Meses SIN override:
//   - ya cerrados con datos → se calculan (cohorte de OCs del mes contra SLA).
//   - en curso o futuros → gris (no se pintan hasta cerrar).
//   - cerrados sin OCs ese mes → gris (sin datos).
//
// Para cambiar el color de un mes a mano, editá/borrá su entrada acá.
export const ESTADO_MES_MANUAL = {
  '2026-01': 'rojo',
  '2026-02': 'rojo',
  '2026-03': 'rojo',
  '2026-04': 'rojo',
  '2026-05': 'verde'
};
