import { createClient } from '@supabase/supabase-js';
import { ATTACHMENTS_BUCKET, SIGNED_URL_LONG_SEC, SIGNED_URL_SHORT_SEC } from './constants';

// ─── CLIENTE SUPABASE ─────────────────────────────────────────────
// Lee las credenciales de las variables de entorno (.env).
// En Vite, las variables expuestas al cliente deben empezar con VITE_.

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan las variables de entorno de Supabase. ' +
    'Verificá que el archivo .env existe y define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession:    true,   // mantiene la sesión entre recargas
    autoRefreshToken:  true,   // renueva el JWT automáticamente
    detectSessionInUrl: true   // necesario para el flujo de magic link / OAuth
  }
});

// ─── MAPEO snake_case ↔ camelCase ─────────────────────────────────
// La base usa snake_case (convención Postgres), la app usa camelCase
// (convención JS). Estas funciones traducen en ambas direcciones.
// Se usan en useSolicitudes al leer/escribir.

// DB → App: una fila de `solicitudes` al objeto `task` que usa la UI
export function rowToTask(row, history = [], attachments = []) {
  return {
    id:                  row.id,
    numero:              row.numero,
    name:                row.name,
    solicitante:         row.solicitante,
    area:                row.area,
    descripcionDetallada: row.descripcion_detallada || '',
    proveedor:           row.proveedor || '',
    proveedorCodigo:     row.proveedor_codigo || null,
    proveedorAdjudicado: row.proveedor_adjudicado || '',
    proveedorAdjudicadoCodigo: row.proveedor_adjudicado_codigo || null,
    prioridad:           row.prioridad,
    paradaDePlanta:      row.parada_de_planta,
    auditoriaInspeccion: row.auditoria_inspeccion,
    tienePresupuesto:    row.tiene_presupuesto,
    presupuestadaAt:     row.presupuestada_at,
    section:             row.section,
    rmaNumber:           row.rma_number,
    cmaNumber:           row.cma_number,
    ocNumber:            row.oc_number,
    monto:               row.monto != null ? String(row.monto) : null,
    fechaOc:             row.fecha_oc,
    fechaCierre:         row.fecha_cierre,
    observaciones:       row.observaciones,
    comentariosRma:      row.comentarios_rma || '',
    numeroFactura:       row.numero_factura || '',
    comentariosOc:       row.comentarios_oc || '',
    completed:           row.section === 'finalizadas',
    // Bloque 4: cancelación + soft delete
    cancelledAt:         row.cancelled_at || null,
    cancellationReason:  row.cancellation_reason || null,
    deletedAt:           row.deleted_at || null,
    // UID del creador (FK a auth.users). Lo necesitamos client-side
    // para `canCancel` — chequea si el usuario logueado es el creador.
    createdBy:           row.created_by || null,
    createdAt:           row.created_at,
    updatedAt:           row.updated_at,
    history:             history.map(rowToHistoryEvent),
    attachments:         attachments.map(rowToAttachment)
  };
}

// App → DB: campos del form a columnas de `solicitudes`
// (solo los campos que el cliente puede setear; numero/created_by/etc los pone el server)
export function taskToRow(data) {
  const row = {};
  if (data.name                 !== undefined) row.name                  = data.name;
  if (data.solicitante          !== undefined) row.solicitante           = data.solicitante;
  if (data.area                 !== undefined) row.area                  = data.area;
  if (data.descripcionDetallada !== undefined) row.descripcion_detallada = data.descripcionDetallada;
  if (data.proveedor            !== undefined) row.proveedor             = data.proveedor;
  if (data.proveedorCodigo      !== undefined) row.proveedor_codigo      = data.proveedorCodigo || null;
  if (data.proveedorAdjudicado  !== undefined) row.proveedor_adjudicado  = data.proveedorAdjudicado || null;
  if (data.proveedorAdjudicadoCodigo !== undefined) row.proveedor_adjudicado_codigo = data.proveedorAdjudicadoCodigo || null;
  if (data.prioridad            !== undefined) row.prioridad             = data.prioridad;
  if (data.paradaDePlanta       !== undefined) row.parada_de_planta      = data.paradaDePlanta;
  if (data.auditoriaInspeccion  !== undefined) row.auditoria_inspeccion  = data.auditoriaInspeccion;
  if (data.tienePresupuesto     !== undefined) row.tiene_presupuesto     = data.tienePresupuesto;
  if (data.presupuestadaAt      !== undefined) row.presupuestada_at      = data.presupuestadaAt;
  if (data.section              !== undefined) row.section               = data.section;
  if (data.rmaNumber            !== undefined) row.rma_number            = data.rmaNumber;
  if (data.cmaNumber            !== undefined) row.cma_number            = data.cmaNumber;
  if (data.ocNumber             !== undefined) row.oc_number             = data.ocNumber;
  if (data.monto                !== undefined) row.monto                 = data.monto ? Number(data.monto) : null;
  if (data.fechaOc              !== undefined) row.fecha_oc              = data.fechaOc || null;
  if (data.fechaCierre          !== undefined) row.fecha_cierre          = data.fechaCierre || null;
  if (data.observaciones        !== undefined) row.observaciones         = data.observaciones;
  if (data.comentariosRma       !== undefined) row.comentarios_rma       = data.comentariosRma || null;
  if (data.numeroFactura        !== undefined) row.numero_factura        = data.numeroFactura || null;
  if (data.comentariosOc        !== undefined) row.comentarios_oc        = data.comentariosOc || null;
  return row;
}

// DB → App: fila de `history_events`
export function rowToHistoryEvent(row) {
  return {
    at:             row.at,
    action:         row.action,
    from:           row.from_section,
    to:             row.to_section,
    fieldsChanged:  row.fields_changed || undefined,
    changes:        row.changes || undefined,
    attachmentName: row.attachment_name || undefined,
    motivo:         row.motivo || undefined,
    values:         row.values || undefined,
    userId:         row.user_id || undefined,
    userEmail:      row.user_email || undefined
  };
}

// App → DB: evento de historial a fila (user_id/user_email los pone el trigger)
export function historyEventToRow(solicitudId, event) {
  return {
    solicitud_id:    solicitudId,
    action:          event.action,
    from_section:    event.from || null,
    to_section:      event.to   || null,
    fields_changed:  event.fieldsChanged || null,
    changes:         event.changes || null,
    attachment_name: event.attachmentName || null,
    motivo:          event.motivo || null,
    values:          event.values || null
  };
}

// DB → App: fila de `attachments`
// Nota: los attachments de DB NO tienen `blob` ni `previewUrl` — solo
// `storagePath`. Para mostrar la imagen hace falta una signed URL
// (ver getSignedUrl). El cliente puede agregar `previewUrl` post-fetch
// para cachear durante la sesión del modal.
export function rowToAttachment(row) {
  return {
    id:          row.id,
    storagePath: row.storage_path,
    name:        row.name,
    type:        row.type,
    size:        row.size,
    isImage:     row.is_image,
    tipo:        row.tipo,
    uploadedAt:  row.uploaded_at,
    isNew:       false   // marca: viene de DB, ya está en Storage
  };
}

// ─── STORAGE: ADJUNTOS ────────────────────────────────────────────
// Helpers de bajo nivel para interactuar con el bucket `attachments`.
// Convención de paths: `<solicitud_id>/<uuid>.<ext>` — UUID puro,
// sin nombre original en el path (el nombre va en la columna `name`).

// Extrae la extensión del nombre original (sin el punto, lowercase).
// Si no hay extensión válida devuelve 'bin' como fallback.
function getExtension(filename) {
  const m = String(filename || '').match(/\.([a-z0-9]{1,8})$/i);
  return m ? m[1].toLowerCase() : 'bin';
}

// Genera un path único para Storage. Usa crypto.randomUUID si está
// disponible (todos los browsers modernos), si no cae a Date+Math
// (compat con browsers viejos, pero no garantizado único bajo concurrencia).
function generateStoragePath(solicitudId, filename) {
  const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const ext = getExtension(filename);
  return `${solicitudId}/${uuid}.${ext}`;
}

// Sube un archivo al bucket + inserta el row en `attachments`.
// Si el upload sale OK pero el insert falla, intenta limpiar el archivo
// del bucket (best-effort; si ese cleanup también falla queda huérfano,
// es un caso documentado para el job de limpieza periódico futuro).
//
// Params:
//   - file: { blob, name, type, size, isImage } — shape devuelto por processFile
//   - solicitudId: UUID de la solicitud padre
//   - tipo: 'presupuesto' | null — para distinguir adjunto de presupuesto vs general
//
// Devuelve: { ok, attachment, error }
export async function uploadAttachment(file, solicitudId, tipo = null) {
  const storagePath = generateStoragePath(solicitudId, file.name);

  // 1) Upload al bucket
  const { error: uploadErr } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(storagePath, file.blob, {
      contentType: file.type || 'application/octet-stream',
      upsert: false   // no debería haber colisión (UUID nuevo), si la hay falla y lo vemos
    });

  if (uploadErr) {
    return { ok: false, error: uploadErr.message || 'Error al subir archivo' };
  }

  // 2) Insert del row en attachments
  const insertRow = {
    solicitud_id: solicitudId,
    storage_path: storagePath,
    name:         file.name,
    type:         file.type || 'application/octet-stream',
    size:         file.size,
    is_image:     !!file.isImage,
    tipo:         tipo || null
  };

  // Nota: NO usar .single() acá. Forzaba el header
  // `Accept: application/vnd.pgrst.object+json` que en algunas combinaciones
  // hace que PostgREST devuelva 400 con el mensaje engañoso "No API key found".
  // Hacemos un .select() normal y tomamos la primera fila a mano.
  const { data: insertedRows, error: insertErr } = await supabase
    .from('attachments')
    .insert(insertRow)
    .select();

  const inserted = insertedRows && insertedRows[0];

  if (insertErr) {
    // Best-effort cleanup: borrar el archivo huérfano del bucket.
    // Si el remove también falla lo logueamos y seguimos — el archivo
    // queda en Storage hasta que un job de limpieza lo barra.
    try {
      const { error: rmErr } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .remove([storagePath]);
      if (rmErr) {
        console.warn('[uploadAttachment] cleanup failed, orphan in bucket:', storagePath, rmErr);
      }
    } catch (cleanupErr) {
      console.warn('[uploadAttachment] cleanup exception:', storagePath, cleanupErr);
    }
    return { ok: false, error: insertErr.message || 'Error al registrar archivo' };
  }

  return { ok: true, attachment: rowToAttachment(inserted) };
}

// Borra múltiples archivos del bucket. Best-effort: si falla NO tira excepción,
// solo loguea. Pensado para limpieza al borrar solicitud (donde la consistencia
// crítica es la DB; los huérfanos físicos son aceptables).
// Si la lista está vacía no hace nada.
export async function deleteAttachmentsFromBucket(storagePaths) {
  if (!storagePaths || storagePaths.length === 0) return { ok: true };
  try {
    const { error } = await supabase.storage
      .from(ATTACHMENTS_BUCKET)
      .remove(storagePaths);
    if (error) {
      console.warn('[deleteAttachmentsFromBucket] failed:', storagePaths, error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[deleteAttachmentsFromBucket] exception:', err);
    return { ok: false, error: String(err) };
  }
}

// Borra un attachment puntual: row de attachments + archivo del bucket.
// Usa el orden DB-first (consistente con deleteTask): primero el row
// (con CASCADE no aplica acá porque solo borramos UNO), después el archivo.
// Si el delete del bucket falla, el row ya está borrado y el archivo
// queda huérfano físicamente.
export async function deleteAttachment(attachmentId, storagePath) {
  const { error: dbErr } = await supabase
    .from('attachments')
    .delete()
    .eq('id', attachmentId);
  if (dbErr) {
    return { ok: false, error: dbErr.message };
  }
  // Best-effort cleanup del archivo físico
  await deleteAttachmentsFromBucket([storagePath]);
  return { ok: true };
}

// Genera una signed URL temporal para acceder a un archivo del bucket privado.
// expiresIn en segundos (default: 1h, ver SIGNED_URL_LONG_SEC).
// Devuelve la URL o null si falla.
export async function getSignedUrl(storagePath, expiresIn = SIGNED_URL_LONG_SEC) {
  if (!storagePath) return null;
  const { data, error } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  if (error) {
    console.warn('[getSignedUrl] failed:', storagePath, error);
    return null;
  }
  return data?.signedUrl || null;
}
// Descarga un adjunto pidiendo una signed URL corta y navegando.
// Para imágenes preview en el modal usar getSignedUrl directamente con
// expiración larga (más eficiente que descargar cada vez).
//
// Si el attachment es nuevo del form (todavía no subido), usa su previewUrl
// local directamente. Caso raro pero seguro.
export async function downloadAttachment(att) {
  if (att.isNew && att.previewUrl) {
    const a = document.createElement('a');
    a.href = att.previewUrl;
    a.download = att.name;
    a.click();
    return;
  }
  const url = await getSignedUrl(att.storagePath, SIGNED_URL_SHORT_SEC);
  if (!url) {
    throw new Error('No se pudo generar el link de descarga.');
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = att.name;
  a.target = '_blank';
  a.rel = 'noopener';
  a.click();
}