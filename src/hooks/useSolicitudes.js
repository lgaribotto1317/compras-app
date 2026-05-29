import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SECTIONS, PRIORIDAD_ORDER, CAMPOS_UNICOS } from '../lib/constants';
import { nowISO } from '../lib/helpers';
import {
  supabase,
  rowToTask, taskToRow,
  historyEventToRow,
  uploadAttachment, deleteAttachment
} from '../lib/supabase';

// ─── useSolicitudes ──────────────────────────────────────────────
// Hook principal de datos. En Bloques 1+2 (Supabase):
// - Lee solicitudes con history_events y attachments anidados (1 query).
// - CRUD apunta a Supabase. Cada operación de escritura hace:
//     1) insert/update en `solicitudes`
//     2) insert del evento correspondiente en `history_events`
//   Los dos pasos son secuenciales, no transaccionales. Si el segundo
//   falla, el primero queda aplicado (decisión documentada en plan).
// - Server-confirmed: el estado local se actualiza DESPUÉS de que
//   Supabase confirme. UI puede tener pequeña latencia (50-200ms).
// - Adjuntos: lectura sí, escritura ignorada hasta el Bloque 3 (Storage).
//
// Errores:
// - Cualquier fallo de red/RLS dispara `onError(msg)` (callback opcional)
//   para que App muestre un toast. La operación devuelve `{ ok, error }`.

export function useSolicitudes({ onError } = {}) {
  const [tasks,           setTasks]           = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [search,          setSearch]          = useState('');
  const [filterPrioridad, setFilterPrioridad] = useState('');
  const [filterArea,      setFilterArea]      = useState('');
  const [filterParada,    setFilterParada]    = useState(false);
  const [filterAuditoria, setFilterAuditoria] = useState(false);
  // Bloque 4: por default OCULTAMOS canceladas en el Kanban (decisión A1).
  // El toggle del FiltersModal las trae cuando hace falta. El filtro de
  // soft-deleted lo aplica la RLS de Supabase (no hace falta tocarlo acá).
  const [includeCancelled, setIncludeCancelled] = useState(false);

  // ── Helper de error: log + notificación al caller ──────────────────
  // Guardamos onError en un ref para que su identidad no provoque que
  // `reportError` (y por cadena `loadAll`) se recreen en cada render
  // del padre. Sin esto, el useEffect que llama a loadAll entraría en
  // loop infinito (App.jsx pasa una arrow function nueva cada render).
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const reportError = useCallback((context, err) => {
    const msg = err?.message || String(err);
    console.error(`[useSolicitudes:${context}]`, err);
    if (onErrorRef.current) onErrorRef.current(`${context}: ${msg}`);
  }, []);

  // ── Carga inicial ────────────────────────────────────────────────
  // Query única con joins anidados. Trae las 3 tablas en un solo
  // round-trip. Para volúmenes chicos/medianos (cientos de solicitudes)
  // es el patrón recomendado por Supabase.
  const loadAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('solicitudes')
      .select('*, history_events(*), attachments(*)')
      .order('created_at', { ascending: false });

    if (error) {
      reportError('Cargar solicitudes', error);
      setTasks([]);
      setLoading(false);
      return;
    }

    const mapped = (data || []).map(row => {
      // El orden del history_events embebido no está garantizado por
      // la query anidada; lo ordenamos por `at` ascendente acá.
      const history = (row.history_events || [])
        .slice()
        .sort((a, b) => new Date(a.at) - new Date(b.at));
      return rowToTask(row, history, row.attachments || []);
    });
    setTasks(mapped);
    setLoading(false);
  }, [reportError]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Helper: insertar un evento en history_events ───────────────────
  // Devuelve { ok, error }. No actualiza estado local — el caller
  // arma el task actualizado y hace setTasks. Si la inserción falla
  // se reporta y se sigue (la solicitud ya está modificada en DB).
  async function appendHistoryEvent(solicitudId, event) {
    const row = historyEventToRow(solicitudId, event);
    const { data, error } = await supabase
      .from('history_events')
      .insert(row)
      .select()
      .single();
    if (error) {
      reportError('Registrar evento de historial', error);
      return { ok: false, error };
    }
    return { ok: true, data };
  }

  // ── CRUD ─────────────────────────────────────────────────────────

  // createTask: inserta solicitud → trigger genera numero atómico →
  // sube cada adjunto al bucket + inserta row en `attachments` →
  // insertamos evento "creada" en history.
  //
  // Upload de adjuntos: en serie, con tolerancia a fallos parciales.
  // Si N de M adjuntos fallan, la solicitud queda creada con los que
  // sí subieron y reportamos los fallidos. NO se hace rollback de la
  // solicitud — el usuario puede reintentar agregando los faltantes
  // por edición.
  // Devuelve { ok, numero, error, uploadFailures? }.
  async function createTask(data) {
    const attachments = data.attachments || [];

    // Mapeo de campos del form a columnas de la tabla. El trigger
    // setea numero, id, created_at, updated_at y user_id automáticamente.
    const insertRow = taskToRow({
      ...data,
      section: 'rma_solicitada',
      tienePresupuesto: data.tienePresupuesto === true,
      presupuestadaAt:  data.tienePresupuesto ? nowISO() : null
    });

    const { data: inserted, error } = await supabase
      .from('solicitudes')
      .insert(insertRow)
      .select()
      .single();

    if (error) {
      reportError('Crear solicitud', error);
      return { ok: false, error: error.message };
    }

    const solicitudId = inserted.id;

    // Upload de adjuntos en serie. Si tienePresupuesto, el primer adjunto
    // se marca como tipo='presupuesto' (convención: el form sube primero
    // el presupuesto cuando ese flag está activo). Si no hay flag, todos
    // van como adjuntos generales.
    //
    // En la práctica el form no distingue: el usuario puede haber subido
    // el presupuesto junto con fotos de referencia. Marcamos 'presupuesto'
    // al PRIMERO solo si el flag está activo y hay al menos 1 archivo —
    // suficiente para que las métricas futuras sepan que hay un presupuesto
    // adjunto. Si necesitamos más precisión, agregamos un selector en el form.
    const uploadFailures = [];
    for (let i = 0; i < attachments.length; i++) {
      const att = attachments[i];
      const tipo = (data.tienePresupuesto && i === 0) ? 'presupuesto' : null;
      const result = await uploadAttachment(att, solicitudId, tipo);
      if (!result.ok) {
        uploadFailures.push({ name: att.name, error: result.error });
      }
    }

    // Evento "creada" en history. Si falla, la solicitud igual quedó.
    const action = data.tienePresupuesto ? 'creada con presupuesto' : 'creada';
    await appendHistoryEvent(solicitudId, {
      action,
      section: 'rma_solicitada'
    });

    // Si hubo fallos de upload, reportarlos vía onError (toast).
    if (uploadFailures.length > 0 && onErrorRef.current) {
      const names = uploadFailures.map(f => f.name).join(', ');
      onErrorRef.current(`No se pudo subir ${uploadFailures.length} archivo(s): ${names}`);
    }

    // Recarga para traer la solicitud con history + attachments embebidos.
    await loadAll();

    return {
      ok: true,
      numero: inserted.numero,
      uploadFailures: uploadFailures.length > 0 ? uploadFailures : undefined
    };
  }

  // editTask: detecta campos cambiados con before→after, update + insert
  // del evento "editada". Además sincroniza adjuntos:
  // - Los attachments en newData con isNew=true → uploadear + insert row
  // - Los attachments que estaban en prevTask y no están en newData → delete
  // - Los attachments existentes (isNew=false) que siguen ahí → no se tocan
  //
  // Eventos de adjuntos: emitimos "archivo agregado" / "archivo eliminado"
  // separados del "editada" principal, para que la trazabilidad sea explícita.
  async function editTask(id, prevTask, newData) {
    // Defensa en profundidad (Bloque 4): no se edita una cancelada.
    if (prevTask?.cancelledAt) {
      return { ok: false, error: 'La solicitud está cancelada. No se puede editar.' };
    }

    const trackedFields = {
      name:               'Título',
      solicitante:        'Solicitante',
      area:               'Área',
      descripcionDetallada: 'Descripción',
      proveedor:          'Proveedor',
      prioridad:          'Prioridad',
      paradaDePlanta:     'Parada de planta',
      auditoriaInspeccion: 'Auditoría/Inspección',
      proveedorAdjudicado: 'Proveedor adjudicado',
      monto:              'Monto',
      rmaNumber:          'Número de RMA',
      ocNumber:           'Número de OC'
    };

    function fmtValue(v) {
      if (v === true)  return 'sí';
      if (v === false) return 'no';
      if (v == null || v === '') return '—';
      const s = String(v);
      return s.length > 100 ? s.slice(0, 100) + '…' : s;
    }

    const changedFields = [];
    const changes       = [];
    Object.keys(trackedFields).forEach(key => {
      if (!(key in newData)) return;
      if (prevTask[key] !== newData[key]) {
        const label = trackedFields[key];
        changedFields.push(label);
        changes.push({
          field:  key,
          label,
          before: fmtValue(prevTask[key]),
          after:  fmtValue(newData[key])
        });
      }
    });

    // Diff de adjuntos
    const prevAttachments = prevTask.attachments || [];
    const newAttachments  = newData.attachments  || [];
    // Nuevos a subir: tienen isNew=true (vienen del form como Blob)
    const toUpload = newAttachments.filter(a => a.isNew);
    // A borrar: estaban en prev y no están en new (match por id de DB)
    const newDbIds = new Set(newAttachments.filter(a => !a.isNew).map(a => a.id));
    const toDelete = prevAttachments.filter(a => !newDbIds.has(a.id));

    const hasAttachmentChanges = toUpload.length > 0 || toDelete.length > 0;

    // Si no cambió nada (ni campos ni adjuntos), no tocamos la base
    if (changedFields.length === 0 && !hasAttachmentChanges) {
      return { ok: true, noop: true };
    }

    // Update en solicitudes (solo si cambiaron campos)
    if (changedFields.length > 0) {
      const updateRow = taskToRow(newData);
      const { error: updErr } = await supabase
        .from('solicitudes')
        .update(updateRow)
        .eq('id', id);
      if (updErr) {
        reportError('Editar solicitud', updErr);
        return { ok: false, error: updErr.message };
      }

      // Insert del evento "editada" con los campos modificados
      await appendHistoryEvent(id, {
        action: 'editada',
        section: prevTask.section,
        fieldsChanged: changedFields,
        changes
      });
    }

    // Upload de adjuntos nuevos (serie, tolerancia a fallos parciales)
    const uploadFailures = [];
    for (const att of toUpload) {
      const result = await uploadAttachment(att, id, null);
      if (!result.ok) {
        uploadFailures.push({ name: att.name, error: result.error });
      } else {
        await appendHistoryEvent(id, {
          action: 'archivo agregado',
          section: prevTask.section,
          attachmentName: att.name
        });
      }
    }

    // Borrado de adjuntos (DB + bucket). Si la DB falla lo reportamos
    // y seguimos con los demás. El bucket es best-effort.
    for (const att of toDelete) {
      const result = await deleteAttachment(att.id, att.storagePath);
      if (!result.ok) {
        reportError(`Eliminar archivo "${att.name}"`, { message: result.error });
      } else {
        await appendHistoryEvent(id, {
          action: 'archivo eliminado',
          section: prevTask.section,
          attachmentName: att.name
        });
      }
    }

    if (uploadFailures.length > 0 && onErrorRef.current) {
      const names = uploadFailures.map(f => f.name).join(', ');
      onErrorRef.current(`No se pudo subir ${uploadFailures.length} archivo(s): ${names}`);
    }

    await loadAll();
    return { ok: true, uploadFailures: uploadFailures.length > 0 ? uploadFailures : undefined };
  }

  // advanceTask: avanzar de etapa (Generar RMA / OC / Finalizar).
  // Update con los campos del step + section nuevo, luego evento.
  async function advanceTask(task, formValues, step) {
    // Defensa en profundidad (Bloque 4): no se puede avanzar una
    // solicitud cancelada. La UI ya oculta los botones, pero esta
    // función es la última frontera client-side. El trigger Postgres
    // también bloquea esto si llegara a pasar.
    if (task.cancelledAt) {
      return { ok: false, error: 'La solicitud está cancelada. No se puede avanzar.' };
    }

    const nextSection = step.next;
    const isFinalize  = nextSection === 'finalizadas';

    // Validación de unicidad cliente-side (RMA/OC duplicado).
    // Es informativa, no bloqueante: si pasa, Postgres rebota igual
    // por el constraint UNIQUE.
    for (const key of Object.keys(CAMPOS_UNICOS)) {
      if (formValues[key] != null && formValues[key] !== '') {
        const norm = String(formValues[key]).trim().toLowerCase();
        const dup = tasks.find(t =>
          t.id !== task.id &&
          String(t[key] ?? '').trim().toLowerCase() === norm
        );
        if (dup) {
          return { ok: false, error: `${CAMPOS_UNICOS[key]} duplicado: "${formValues[key]}" ya está en uso` };
        }
      }
    }

    const updateData = {
      ...formValues,
      section:   nextSection,
      completed: isFinalize ? true : task.completed
    };
    const updateRow = taskToRow(updateData);

    const { error: updErr } = await supabase
      .from('solicitudes')
      .update(updateRow)
      .eq('id', task.id);
    if (updErr) {
      reportError('Avanzar solicitud', updErr);
      return { ok: false, error: updErr.message };
    }

    await appendHistoryEvent(task.id, {
      action: step.label,
      from:   task.section,
      to:     nextSection,
      values: formValues
    });

    await loadAll();
    return { ok: true, nextSection };
  }

  // softDeleteTask: marca la solicitud como soft-deleted (deleted_at = NOW).
  // RLS solo permite hacerlo a admin (ver bloque4.sql). Los attachments
  // y history_events NO se tocan — quedan vinculados a la solicitud y
  // siguen siendo accesibles si se hace restore (no implementado en UI).
  //
  // Decisión D1: los archivos físicos del bucket NO se borran. Soft delete
  // es reversible conceptualmente; si en N meses se quiere purga real,
  // se hace con un job manual.
  //
  // Registramos un evento "eliminada" en history para trazabilidad
  // (quién la eliminó y cuándo).
  async function softDeleteTask(id) {
    const { error } = await supabase
      .from('solicitudes')
      .update({ deleted_at: nowISO() })
      .eq('id', id);
    if (error) {
      reportError('Eliminar solicitud', error);
      return { ok: false, error: error.message };
    }

    // Evento de history. Si falla NO rollbackeamos (la solicitud ya
    // está soft-deleted en DB y eso es lo crítico para la UI).
    await appendHistoryEvent(id, {
      action: 'eliminada',
      section: tasks.find(t => t.id === id)?.section
    });

    await loadAll();
    return { ok: true };
  }

  // cancelTask: marca la solicitud como cancelada con motivo + history.
  // RLS aplica las reglas por sección + función (ver bloque4.sql).
  // Trigger Postgres valida:
  //   - No se puede cancelar una finalizada (rebota con excepción).
  //   - Motivo obligatorio (la UI ya lo valida, esto es backup).
  //   - No se puede descancelar (B2).
  //
  // No cambia la `section` de la solicitud — queda "viva" en la sección
  // donde estaba al momento de cancelar. La UI la oculta del Kanban
  // por default (decisión A1), salvo que el filtro "ver canceladas"
  // esté activo.
  async function cancelTask(id, motivo) {
    const trimmed = (motivo || '').trim();
    if (!trimmed) {
      return { ok: false, error: 'El motivo de cancelación es obligatorio.' };
    }

    const { error } = await supabase
      .from('solicitudes')
      .update({
        cancelled_at:        nowISO(),
        cancellation_reason: trimmed
      })
      .eq('id', id);
    if (error) {
      reportError('Cancelar solicitud', error);
      return { ok: false, error: error.message };
    }

    const task = tasks.find(t => t.id === id);
    await appendHistoryEvent(id, {
      action: 'cancelada',
      section: task?.section,
      motivo: trimmed
    });

    await loadAll();
    return { ok: true };
  }

  // deleteTask: alias retrocompat. Llama a softDeleteTask. Mantenemos
  // el nombre para no romper la API del hook. El "DELETE físico" real
  // queda accesible solo desde el SQL Editor (admin manual).
  async function deleteTask(id) {
    return softDeleteTask(id);
  }

  // ── PRESUPUESTO ──────────────────────────────────────────────────
  // cargarPresupuesto: sube el adjunto al bucket marcándolo con tipo='presupuesto',
  // marca el flag tiene_presupuesto en la solicitud y registra el evento.
  //
  // Si el upload falla NO marcamos el flag (sería inconsistente: flag activo
  // sin presupuesto adjunto). Devolvemos error y el usuario reintenta.
  // Si el upload sale OK pero el update del flag falla, queda el archivo
  // subido pero la solicitud sin la marca — caso raro, lo dejamos así
  // (el usuario ve el archivo en attachments y puede reintentar el flag).

  async function cargarPresupuesto(taskId, attachment) {
    if (!attachment) {
      return { ok: false, error: 'No hay archivo adjunto.' };
    }

    // Defensa en profundidad (Bloque 4)
    const task = tasks.find(t => t.id === taskId);
    if (task?.cancelledAt) {
      return { ok: false, error: 'La solicitud está cancelada. No se puede cargar presupuesto.' };
    }

    // 1) Upload del adjunto con tipo='presupuesto'
    const uploadResult = await uploadAttachment(attachment, taskId, 'presupuesto');
    if (!uploadResult.ok) {
      if (onErrorRef.current) onErrorRef.current(`No se pudo subir el presupuesto: ${uploadResult.error}`);
      return { ok: false, error: uploadResult.error };
    }

    // 2) Update del flag tiene_presupuesto + timestamp
    const now = nowISO();
    const { error } = await supabase
      .from('solicitudes')
      .update({ tiene_presupuesto: true, presupuestada_at: now })
      .eq('id', taskId);
    if (error) {
      reportError('Cargar presupuesto', error);
      // El archivo ya se subió pero el flag no se marcó — informamos pero
      // no rollbackeamos (el adjunto sigue siendo válido como tal).
      return { ok: false, error: error.message };
    }

    // 3) Evento history
    await appendHistoryEvent(taskId, {
      action: 'presupuesto cargado',
      section: tasks.find(t => t.id === taskId)?.section,
      attachmentName: attachment.name
    });
    await loadAll();
    return { ok: true };
  }

  async function quitarPresupuesto(taskId, motivo) {
    // Defensa en profundidad (Bloque 4)
    const task = tasks.find(t => t.id === taskId);
    if (task?.cancelledAt) {
      return { ok: false, error: 'La solicitud está cancelada. No se puede modificar el presupuesto.' };
    }

    const { error } = await supabase
      .from('solicitudes')
      .update({ tiene_presupuesto: false, presupuestada_at: null })
      .eq('id', taskId);
    if (error) {
      reportError('Quitar presupuesto', error);
      return { ok: false, error: error.message };
    }
    await appendHistoryEvent(taskId, {
      action: 'presupuesto removido',
      section: tasks.find(t => t.id === taskId)?.section,
      motivo: motivo || null
    });
    await loadAll();
    return { ok: true };
  }

  // ── UTILIDADES ───────────────────────────────────────────────────
  // loadSamples ya no existe — sample data deprecada con Supabase.
  // Se deja stub que no hace nada para compatibilidad con App.jsx.
  function loadSamples() {
    if (onError) onError('Carga de ejemplos no disponible con Supabase.');
  }

  // ── DATOS DERIVADOS ──────────────────────────────────────────────

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      // Canceladas: por default ocultas (decisión A1). El toggle del modal
      // las trae si el usuario quiere verlas (ej. para métricas o consultas).
      if (!includeCancelled && t.cancelledAt) return false;

      if (search) {
        const q   = search.toLowerCase();
        const hay = [t.name, t.solicitante, t.area, t.proveedor, t.descripcionDetallada, t.rmaNumber, t.ocNumber]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterPrioridad && t.prioridad !== filterPrioridad) return false;
      if (filterArea      && t.area      !== filterArea)      return false;
      if (filterParada    && !t.paradaDePlanta)               return false;
      if (filterAuditoria && !t.auditoriaInspeccion)          return false;
      return true;
    });
  }, [tasks, search, filterPrioridad, filterArea, filterParada, filterAuditoria, includeCancelled]);

  const counts = useMemo(() => {
    const c = {};
    SECTIONS.forEach(s => { c[s.id] = 0; });
    filtered.forEach(t => { if (c[t.section] !== undefined) c[t.section]++; });
    return c;
  }, [filtered]);

  function tasksInSection(sectionId) {
    return filtered
      .filter(t => t.section === sectionId)
      .sort((a, b) => {
        const pa = PRIORIDAD_ORDER[a.prioridad] ?? 3;
        const pb = PRIORIDAD_ORDER[b.prioridad] ?? 3;
        if (pa !== pb) return pa - pb;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  }

  const hasActiveFilters = !!(search || filterPrioridad || filterArea || filterParada || filterAuditoria || includeCancelled);

  return {
    // Estado
    tasks,
    filtered,
    counts,
    loading,
    hasActiveFilters,

    // Filtros
    search,          setSearch,
    filterPrioridad, setFilterPrioridad,
    filterArea,      setFilterArea,
    filterParada,    setFilterParada,
    filterAuditoria, setFilterAuditoria,
    includeCancelled, setIncludeCancelled,

    // CRUD
    createTask,
    editTask,
    advanceTask,
    deleteTask,        // alias: hace soft delete
    softDeleteTask,    // explícito (mismo comportamiento que deleteTask)
    cancelTask,        // Bloque 4

    // Presupuesto
    cargarPresupuesto,
    quitarPresupuesto,

    // Helpers de vista
    tasksInSection,
    loadSamples,    // stub para retrocompat con App.jsx

    // Recarga manual (útil para Realtime en Bloque 4)
    reload: loadAll
  };
}
