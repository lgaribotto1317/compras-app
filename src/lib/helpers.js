import { MAX_IMG_DIM, IMG_QUALITY, MAX_FILE_SIZE, GROUP_KEY_BY_SECTION, PRIORIDAD_ORDER } from './constants';

// ─── IDs Y TIMESTAMPS ─────────────────────────────────────────────
export const uid    = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const nowISO = () => new Date().toISOString();

// ─── NUMERACIÓN SECUENCIAL ────────────────────────────────────────
// Devuelve el siguiente número en formato #000001.
// NOTA: En el standalone (un usuario) no hay race condition.
// En Supabase la unicidad la garantiza un trigger Postgres con sequence atómica —
// esta función se reemplaza por el valor que devuelve el INSERT.
export function getNextNumber(tasks) {
  const nums = (tasks || [])
    .map(t => {
      if (!t.numero) return 0;
      const m = String(t.numero).match(/(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return '#' + String(max + 1).padStart(6, '0');
}

// ─── FORMATO DE FECHAS ────────────────────────────────────────────
export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export const fmtDateShort = (iso) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '';

// Tiempo relativo (para historial)
export function timeAgo(iso) {
  const ms  = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60)  return 'recién';
  const min = Math.floor(sec / 60);
  if (min < 60)  return `${min}m`;
  const h   = Math.floor(min / 60);
  if (h   < 24)  return `${h}h`;
  const d   = Math.floor(h / 24);
  if (d   < 30)  return `${d}d`;
  const mo  = Math.floor(d / 30);
  return `${mo}mo`;
}

// ─── FORMATO DE BYTES ─────────────────────────────────────────────
export function fmtBytes(n) {
  if (!n)                 return '0 B';
  if (n < 1024)           return `${n} B`;
  if (n < 1024 * 1024)   return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ─── UNICIDAD DE IDENTIFICADORES ─────────────────────────────────
// Normaliza un identificador (trim + lowercase) para comparar unicidad.
export function normalizarIdentificador(v) {
  return (v ?? '').toString().trim().toLowerCase();
}

// Dado un campo único (rmaNumber / cmaNumber / ocNumber), un valor y la
// lista completa de solicitudes, devuelve true si el valor ya está en uso
// por una fila FUERA de la selección excluida.
//
// `exclude` puede ser: undefined (no excluye nada), un id (string), un
// array de ids, o un Set de ids. Esto soporta la consolidación N→1: al
// asignar un número a un grupo, se excluyen TODAS las filas del grupo
// (las que van a compartir el número) y se chequea colisión contra el resto.
// Con un solo id el comportamiento es el de antes (editar una solicitud).
export function existeIdentificadorDuplicado(allTasks, fieldKey, value, exclude) {
  const norm = normalizarIdentificador(value);
  if (!norm) return false; // vacío nunca es duplicado
  const excludeSet =
    exclude == null            ? null :
    exclude instanceof Set     ? exclude :
    Array.isArray(exclude)     ? new Set(exclude) :
                                 new Set([exclude]);
  return allTasks.some(t => {
    if (excludeSet && excludeSet.has(t.id)) return false;
    return normalizarIdentificador(t[fieldKey]) === norm;
  });
}

// ─── AGRUPACIÓN (CONSOLIDACIÓN N→1) ───────────────────────────────
// groupKeyForSection: campo identificador del grupo en esa sección
// (rmaNumber / cmaNumber / ocNumber) o null si las filas son individuales.
export function groupKeyForSection(section) {
  return GROUP_KEY_BY_SECTION[section] || null;
}

// Prioridad "más alta" de un set de filas (Alta > Media > Baja).
// Se usa para que la card de grupo muestre la prioridad dominante.
function topPrioridadDe(rows) {
  let best = null;
  let bestOrder = Infinity;
  for (const r of rows) {
    const o = PRIORIDAD_ORDER[r.prioridad] ?? 3;
    if (o < bestOrder) { bestOrder = o; best = r.prioridad; }
  }
  return best;
}

// groupItems: agrupa las filas de UNA sección por su número identificador.
// Devuelve un array de grupos preservando el orden de aparición de `items`
// (que ya viene ordenado por prioridad+fecha desde tasksInSection).
//
// Reglas:
//  - En secciones sin keyField (rma_solicitada) cada fila es su propio grupo.
//  - Las filas CANCELADAS nunca se pliegan en un grupo activo: van como
//    grupo singleton (se renderizan como card individual cancelada).
//  - Filas con número nulo/vacío también van como singleton.
//
// Cada grupo expone agregados para que la card de grupo (Tanda 1b) muestre
// recuento, áreas, prioridad dominante, adjuntos totales y flags. `rep` es
// la fila representativa (primera) — útil para permisos (canAdvance) y para
// abrir el detalle en el interino. `monto` es el de la CMA (replicado en
// todos los miembros → se toma 1× de rep).
export function groupItems(items, section) {
  const keyField = groupKeyForSection(section);
  const buckets = new Map();   // mapKey -> rows[]
  let singletonSeq = 0;

  for (const t of items) {
    const canceled = !!t.cancelledAt;
    const keyVal = (!canceled && keyField) ? t[keyField] : null;
    const mapKey = (keyVal == null || keyVal === '')
      ? `__single_${singletonSeq++}`        // único → grupo propio
      : `${keyField}:${String(keyVal)}`;
    if (!buckets.has(mapKey)) buckets.set(mapKey, []);
    buckets.get(mapKey).push(t);
  }

  const groups = [];
  for (const rows of buckets.values()) {
    const rep    = rows[0];
    const keyVal = keyField ? (rep[keyField] ?? null) : null;
    groups.push({
      id:                  rep.id,                 // representativa (click → detalle, interino)
      keyField,                                    // 'rmaNumber' | 'cmaNumber' | 'ocNumber' | null
      key:                 keyVal,                 // valor del número del grupo
      rows,
      rep,
      isGroup:             rows.length > 1,
      count:               rows.length,
      areas:               [...new Set(rows.map(r => r.area).filter(Boolean))],
      prioridad:           topPrioridadDe(rows),
      attachmentsCount:    rows.reduce((n, r) => n + ((r.attachments || []).length), 0),
      paradaDePlanta:      rows.some(r => r.paradaDePlanta),
      auditoriaInspeccion: rows.some(r => r.auditoriaInspeccion),
      cancelled:           rows.length === 1 && !!rep.cancelledAt,
      monto:               rep.monto ?? null,
      // Identificadores de los hijos del grupo, para badge + lista de
      // trazabilidad en la card (consolidación N→1):
      //   - solicitudNumeros: el #00000N de cada solicitud miembro.
      //   - rmaNumeros:       los RMA distintos que componen el grupo
      //                       (una CMA fusiona varias RMA).
      solicitudNumeros:    rows.map(r => r.numero).filter(Boolean),
      rmaNumeros:          [...new Set(rows.map(r => r.rmaNumber).filter(Boolean))]
    });
  }
  return groups;
}

// Ids de los miembros de un grupo que SÍ pueden avanzar (no cancelados ni
// eliminados). advanceTasks vuelve a filtrar por las dudas, pero esto le
// sirve a la UI para armar la selección y mostrar el recuento real.
export function advanceableIds(group) {
  return group.rows
    .filter(r => !r.cancelledAt && !r.deletedAt)
    .map(r => r.id);
}

// ─── PROCESAMIENTO DE ADJUNTOS ────────────────────────────────────
// Comprime imágenes antes de subirlas al bucket (limita a MAX_IMG_DIM px).
// Devuelve un Blob (no dataUrl) listo para upload directo a Supabase Storage.
// La compresión se mantiene client-side: reduce transferencia y consumo
// de storage. Decisión documentada: GMP no exige preservar original sin
// alterar para este caso de uso (fotos de referencia + presupuestos PDF
// que no se comprimen).
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height && width > MAX_IMG_DIM) {
          height = Math.round(height * MAX_IMG_DIM / width);
          width  = MAX_IMG_DIM;
        } else if (height > MAX_IMG_DIM) {
          width  = Math.round(width * MAX_IMG_DIM / height);
          height = MAX_IMG_DIM;
        }
        canvas.width  = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        // canvas.toBlob es asíncrono — wrapeamos en promesa
        canvas.toBlob(
          blob => {
            if (blob) resolve(blob);
            else      reject(new Error('No se pudo generar el blob de la imagen'));
          },
          'image/jpeg',
          IMG_QUALITY
        );
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Error leyendo el archivo'));
    reader.readAsDataURL(file);
  });
}

// Procesa un archivo para upload a Supabase Storage:
// - Si es imagen: comprime → devuelve Blob + previewUrl local (URL.createObjectURL)
// - Si no es imagen: valida tamaño → devuelve el File como blob + previewUrl
//
// IMPORTANTE: previewUrl es un blob: URL local. Hay que revocarla con
// URL.revokeObjectURL() cuando el componente que la usa se desmonta,
// para no leakear memoria. TaskFormModal y CargarPresupuestoModal lo
// hacen al cerrar.
//
// Shape devuelto (compatible con uploadAttachment de supabase.js):
//   { id, blob, name, type, size, isImage, previewUrl, isNew: true, addedAt }
//
// `id` es temporal — solo para que el form pueda agregarlo/sacarlo del array
// local antes de uploadear. Una vez que sube y se inserta en `attachments`,
// el id real lo asigna Postgres.
export async function processFile(file) {
  const isImage = file.type.startsWith('image/');
  if (!isImage && file.size > MAX_FILE_SIZE) {
    throw new Error(`"${file.name}" supera ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB. Tope del bucket.`);
  }

  let blob;
  if (isImage) {
    try {
      blob = await compressImage(file);
    } catch {
      // Si la compresión falla (imagen corrupta, formato raro), usamos el original.
      // Igual valida contra MAX_FILE_SIZE.
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`"${file.name}" supera ${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB y no se pudo comprimir.`);
      }
      blob = file;
    }
  } else {
    blob = file;
  }

  const previewUrl = URL.createObjectURL(blob);

  return {
    id:         uid(),     // temporal, solo para tracking en el form
    blob,                  // el archivo a subir
    name:       file.name,
    type:       blob.type || file.type || 'application/octet-stream',
    size:       blob.size,
    isImage,
    previewUrl,            // blob: URL para mostrar mientras está en el form
    isNew:      true,      // marca: todavía no subido
    addedAt:    nowISO()
  };
}

// Revoca las previewUrls locales de un array de attachments (los nuevos).
// Hay que llamarla cuando el componente que los tenía se desmonta, para
// no leakear memoria. Es seguro pasarle attachments mixtos (nuevos +
// los que vienen de DB) — solo procesa los que tienen previewUrl + isNew.
export function revokePreviewUrls(attachments) {
  (attachments || []).forEach(a => {
    if (a.isNew && a.previewUrl) {
      try {
        URL.revokeObjectURL(a.previewUrl);
      } catch {
        // ignorar — si no era válida no importa
      }
    }
  });
}

// NOTA: downloadAttachment se movió a lib/supabase.js para romper la
// dependencia circular helpers ↔ supabase. Importalo desde ahí.

// Construye los chips del banner de filtros activos a partir del estado del modal.
// Se usa en Kanban y Dashboard (donde además se agrega el chip del período).
// Devuelve array de { label, tone }.
export function buildModalFilterChips({ search, filterPrioridad, filterArea, filterParada, filterAuditoria, filterPresupuesto, includeCancelled }) {
  const chips = [];
  if (search)          chips.push({ label: `Búsqueda: "${search}"`, tone: 'slate' });
  if (filterPrioridad) chips.push({ label: `Prioridad: ${filterPrioridad}`, tone: 'slate' });
  if (filterArea)      chips.push({ label: `Área: ${filterArea}`, tone: 'slate' });
  if (filterParada)    chips.push({ label: 'Solo con parada de planta', tone: 'red' });
  if (filterAuditoria) chips.push({ label: 'Solo con auditoría/inspección', tone: 'violet' });
  if (filterPresupuesto === 'con') chips.push({ label: 'Con presupuesto', tone: 'emerald' });
  if (filterPresupuesto === 'sin') chips.push({ label: 'Sin presupuesto', tone: 'orange' });
  if (includeCancelled) chips.push({ label: 'Incluye canceladas', tone: 'slate' });
  return chips;
}

// ─── PERMISOS DE CANCELACIÓN ──────────────────────────────────────
// Determina si el `user` actual puede cancelar la `task`. Espejo
// client-side de la policy UPDATE de Supabase (ver bloque4.sql).
//
// Reglas (decisión cerrada con el usuario, 28/may/2026):
//   1) Si la solicitud ya está cancelada o soft-deleted → no.
//   2) Si la solicitud está en `finalizadas` → no (decisión C2).
//   3) Si el user es admin → sí, siempre.
//   4) Si el user es el creador AND la sección está en
//      SOLICITANTE_PUEDE_CANCELAR_EN → sí.
//   5) Si la `funcion` del user está en CANCEL_RULES[sección] → sí.
//   6) Caso contrario → no.
//
// El cálculo se hace con el JWT que ya tenemos en memoria. No hace
// queries adicionales — es síncrono, llamable en render.
//
// IMPORTANTE: esta función es solo cosmética (mostrar/ocultar botón).
// La seguridad real la garantiza la RLS de Supabase. Si alguien hackea
// el DOM y dispara cancelTask, Postgres rebota con error de RLS.
import { CANCEL_RULES, SOLICITANTE_PUEDE_CANCELAR_EN } from './constants';

export function canCancel(task, user) {
  if (!task || !user) return false;

  // Estados que bloquean cancelación
  if (task.cancelledAt) return false;
  if (task.deletedAt)   return false;
  if (task.section === 'finalizadas') return false;

  // Admin transversal
  const role = user.app_metadata?.role;
  if (role === 'admin') return true;

  // Creador en sección permitida
  const isOwner = task.createdBy && task.createdBy === user.id;
  if (isOwner && SOLICITANTE_PUEDE_CANCELAR_EN.includes(task.section)) {
    return true;
  }

  // Función habilitada para esta sección
  const funcion = user.app_metadata?.funcion;
  const allowed = CANCEL_RULES[task.section] || [];
  if (funcion && allowed.includes(funcion)) {
    return true;
  }

  return false;
}

// Helper menor: ¿el user es admin? Lectura del claim.
export function isUserAdmin(user) {
  return user?.app_metadata?.role === 'admin';
}

// ─── PERMISOS DE AVANCE Y EDICIÓN (Bloque 4 — refinamiento 28/may) ──
// Reglas hablan a la policy UPDATE + trigger Postgres. Mantener
// estos helpers SIEMPRE alineados con bloque4-permisos-por-accion.sql.
// Si las reglas cambian, hay que tocar acá Y en el trigger.

// ¿Puede el usuario AVANZAR la solicitud (cambiar a la próxima sección)?
//   rma_solicitada → rma_generada  : responsable_rma
//   rma_generada   → rma_valorizada: compras  (Valorizar RMA)
//   rma_valorizada → oc_generada   : compras  (Generar OC)
//   oc_generada    → finalizadas   : responsable_rma  (recepción de material)
export function canAdvance(task, user) {
  if (!task || !user) return false;
  if (task.cancelledAt) return false;
  if (task.deletedAt)   return false;

  const role = user.app_metadata?.role;
  if (role === 'admin') return true;

  const funcion = user.app_metadata?.funcion;

  if (task.section === 'rma_solicitada') return funcion === 'responsable_rma';
  if (task.section === 'rma_generada')   return funcion === 'compras';
  if (task.section === 'rma_valorizada') return funcion === 'compras';
  if (task.section === 'oc_generada')    return funcion === 'responsable_rma';
  // finalizadas: no se avanza más
  return false;
}

// ¿Puede el usuario EDITAR campos de la solicitud (sin avanzar etapa)?
//   rma_solicitada : creador
//   rma_generada   : responsable_rma
//   rma_valorizada : compras
//   oc_generada    : compras
//   finalizadas    : nadie (excepto admin)
export function canEdit(task, user) {
  if (!task || !user) return false;
  if (task.cancelledAt) return false;
  if (task.deletedAt)   return false;

  const role = user.app_metadata?.role;
  if (role === 'admin') return true;

  const funcion = user.app_metadata?.funcion;
  const isOwner = task.createdBy && task.createdBy === user.id;

  if (task.section === 'rma_solicitada') return isOwner;
  if (task.section === 'rma_generada')   return funcion === 'responsable_rma';
  if (task.section === 'rma_valorizada') return funcion === 'compras';
  if (task.section === 'oc_generada')    return funcion === 'compras';
  // finalizadas: nadie editable
  return false;
}

// ¿Puede el usuario cargar/quitar presupuesto?
// Solo aplica en rma_solicitada. Pueden: creador o responsable_rma.
export function canBudget(task, user) {
  if (!task || !user) return false;
  if (task.cancelledAt) return false;
  if (task.deletedAt)   return false;
  if (task.section !== 'rma_solicitada') return false;

  const role = user.app_metadata?.role;
  if (role === 'admin') return true;

  const funcion = user.app_metadata?.funcion;
  const isOwner = task.createdBy && task.createdBy === user.id;

  return isOwner || funcion === 'responsable_rma';
}

// ¿Puede el usuario cargar/editar número de factura y comentarios de OC?
// Aplica desde oc_generada en adelante (incluye finalizadas: la factura
// suele llegar después de recibir el material). Pueden hacerlo:
//   - el creador (solicitante) de la solicitud
//   - responsable_rma
//   - compras
//   - admin (transversal)
// Espejo EXACTO del bloque v_editing_factura del trigger Postgres
// (solicitudes_check_state_transitions). Si cambia uno, cambiar el otro.
export function canEditFactura(task, user) {
  if (!task || !user) return false;
  if (task.cancelledAt) return false;
  if (task.deletedAt)   return false;
  if (!['oc_generada', 'finalizadas'].includes(task.section)) return false;

  const role = user.app_metadata?.role;
  if (role === 'admin') return true;

  const funcion = user.app_metadata?.funcion;
  const isOwner = task.createdBy && task.createdBy === user.id;

  return isOwner || funcion === 'responsable_rma' || funcion === 'compras';
}
