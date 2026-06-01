import React, { useState, useRef, useEffect } from 'react';
import {
  AlertTriangle, ShieldCheck, Receipt, Paperclip,
  Loader2, FileText, AlertCircle, X
} from 'lucide-react';
import { AREAS, PRIORIDADES, MAX_TOTAL_STORAGE } from '../../lib/constants';
import { processFile, fmtBytes, revokePreviewUrls } from '../../lib/helpers';
import { getSignedUrl } from '../../lib/supabase';
import { ModalShell, Field, ModalActions } from '../../components/ModalShell';
import { ProveedorCombobox } from '../../components/ProveedorCombobox';

// ─── AttachmentsField ─────────────────────────────────────────────
// Renderiza la lista de adjuntos del form. Cada attachment puede ser:
// - Nuevo (isNew=true): viene de processFile, tiene blob + previewUrl local.
// - Existente (isNew=false): viene de DB, tiene storagePath. Si es imagen,
//   pedimos una signed URL para mostrar el thumbnail.
//
// Las signed URLs se generan on-mount y se cachean en un Map keyed por id.
// No hay revocación porque son URLs HTTPS remotas, no blob: locales.
function AttachmentsField({ attachments, onAdd, onRemove, uploading, error, required, requiredLabel }) {
  const inputRef       = useRef(null);
  const totalBytes     = attachments.reduce((acc, a) => acc + (a.size || 0), 0);
  const isMissingRequired = required && attachments.length === 0;

  // Cache de signed URLs para attachments existentes (imagen) por id de DB.
  // Mapa { [att.id]: signedUrl }. Se actualiza cuando aparece un attachment
  // existente que no tenemos cacheado.
  const [signedUrls, setSignedUrls] = useState({});

  useEffect(() => {
    const needed = attachments.filter(a => !a.isNew && a.isImage && !signedUrls[a.id]);
    if (needed.length === 0) return;
    let cancelled = false;
    (async () => {
      const updates = {};
      for (const att of needed) {
        const url = await getSignedUrl(att.storagePath);
        if (url) updates[att.id] = url;
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setSignedUrls(prev => ({ ...prev, ...updates }));
      }
    })();
    return () => { cancelled = true; };
  }, [attachments, signedUrls]);

  // Devuelve la URL de imagen a usar para el thumbnail del attachment.
  // Para nuevos: previewUrl local. Para existentes: signedUrl cacheada (puede
  // ser undefined mientras carga — el render maneja el fallback al ícono).
  function getThumbUrl(a) {
    if (a.isNew) return a.previewUrl;
    return signedUrls[a.id];
  }

  return (
    <Field
      label={required ? 'Adjuntos · Presupuesto requerido' : 'Adjuntos (fotos, presupuestos, PDFs)'}
      required={required}
      hint={required ? requiredLabel : undefined}
      error={isMissingRequired ? 'Tenés que adjuntar al menos un archivo' : undefined}
    >
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          className="hidden"
          onChange={e => {
            if (e.target.files?.length) {
              onAdd(Array.from(e.target.files));
              e.target.value = '';
            }
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-slate-300 rounded-md text-sm text-slate-600 hover:border-sky-500 hover:text-sky-700 hover:bg-sky-50/50 transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
          {uploading ? 'Procesando...' : 'Agregar archivos'}
        </button>

        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md p-2 flex items-start gap-1.5">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {attachments.length > 0 && (
          <>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {attachments.map(a => {
                const thumbUrl = getThumbUrl(a);
                return (
                  <div key={a.id} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-md">
                    {a.isImage && thumbUrl ? (
                      <img src={thumbUrl} alt={a.name} className="w-9 h-9 rounded object-cover border border-slate-200" />
                    ) : (
                      <div className="w-9 h-9 rounded bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        {a.isImage ? (
                          <Loader2 size={14} className="animate-spin text-slate-400" />
                        ) : (
                          <FileText size={16} className="text-slate-500" />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">{a.name}</p>
                      <p className="font-mono text-[10px] text-slate-500">
                        {fmtBytes(a.size)}
                        {!a.isNew && <span className="ml-1.5 text-emerald-600">· guardado</span>}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(a.id)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="font-mono text-[10px] text-slate-500 text-right">
              {attachments.length} {attachments.length === 1 ? 'archivo' : 'archivos'} · {fmtBytes(totalBytes)}
            </p>
          </>
        )}
      </div>
    </Field>
  );
}

// ─── TaskFormModal ────────────────────────────────────────────────
export function TaskFormModal({ mode, task, onClose, onSubmit, defaultSolicitante = '', proveedores = [], loadingProveedores = false }) {
  const [form, setForm] = useState({
    name:                task?.name                || '',
    // En modo create, autocompletar con defaultSolicitante (nombre del
    // usuario logueado). En edit respetamos el solicitante original.
    // El usuario puede editarlo libremente igual.
    solicitante:         task?.solicitante         || defaultSolicitante || '',
    area:                task?.area                || AREAS[0],
    descripcionDetallada: task?.descripcionDetallada || '',
    proveedor:           task?.proveedor           || '',
    proveedorCodigo:     task?.proveedorCodigo     || null,
    prioridad:           task?.prioridad           || 'Media',
    paradaDePlanta:      task?.paradaDePlanta      || false,
    auditoriaInspeccion: task?.auditoriaInspeccion || false,
    tienePresupuesto:    task?.tienePresupuesto    || false,
    // En modo edit, los attachments vienen de DB (isNew=false) y se mantienen.
    // El usuario puede agregar nuevos (isNew=true) o sacar existentes.
    // useSolicitudes.editTask después calcula el diff y sube/borra lo que cambió.
    attachments:         task?.attachments         || []
  });
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState(null);

  // Ref al estado más reciente de attachments para el cleanup unmount.
  // Sin esto el cleanup ve el array vacío del closure inicial.
  const attachmentsRef = useRef(form.attachments);
  useEffect(() => { attachmentsRef.current = form.attachments; }, [form.attachments]);

  // Al desmontar el modal, revocar las previewUrls locales de los attachments
  // nuevos que quedaron en el state. Si el usuario llegó a submitearlos,
  // el array se actualizó y el ref apunta a lo que sea que quedó al final.
  //
  // Nota: si el usuario submitea OK, los previewUrls de los nuevos siguen
  // siendo válidas durante el upload (que ocurre en useSolicitudes después
  // de cerrar el modal). Las revocamos acá igual — para entonces ya se subió
  // el blob y no se necesita la URL local más. Si por alguna razón el upload
  // se retrasa después del unmount, la revocación rompería los thumbnails,
  // pero el modal ya está cerrado, así que no se ve.
  useEffect(() => {
    return () => {
      revokePreviewUrls(attachmentsRef.current);
    };
  }, []);

  // Si el usuario vacía el campo Solicitante y mueve el foco, lo recompletamos
  // con el nombre del usuario logueado. Evita errores tipográficos accidentales
  // (borrar todo y olvidarse de rellenar). Solo aplica en modo create.
  function handleSolicitanteBlur() {
    if (mode === 'create' && !form.solicitante.trim() && defaultSolicitante) {
      setForm(prev => ({ ...prev, solicitante: defaultSolicitante }));
    }
  }

  const presupuestoOk = !form.tienePresupuesto || form.attachments.length > 0;
  const canSubmit     = form.name.trim() && form.solicitante.trim() && presupuestoOk;

  async function handleFiles(files) {
    setFileError(null);
    setUploading(true);
    try {
      const newAtt = [];
      for (const f of files) {
        try {
          newAtt.push(await processFile(f));
        } catch (err) {
          setFileError(err.message || `Error al procesar "${f.name}"`);
        }
      }
      const allAtt    = [...form.attachments, ...newAtt];
      const totalBytes = allAtt.reduce((acc, a) => acc + (a.size || 0), 0);
      if (totalBytes > MAX_TOTAL_STORAGE) {
        setFileError(`Tamaño total (${fmtBytes(totalBytes)}) supera el límite. Quitá algún archivo.`);
        return;
      }
      setForm(prev => ({ ...prev, attachments: allAtt }));
    } finally {
      setUploading(false);
    }
  }

  function removeAttachment(id) {
    setForm(prev => {
      const removed = prev.attachments.find(a => a.id === id);
      // Si era un attachment nuevo del form (todavía no subido), revocar
      // su previewUrl local para no leakear memoria.
      if (removed?.isNew && removed.previewUrl) {
        try { URL.revokeObjectURL(removed.previewUrl); } catch { /* ignorar */ }
      }
      return { ...prev, attachments: prev.attachments.filter(a => a.id !== id) };
    });
  }

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({
      name:                form.name.trim(),
      solicitante:         form.solicitante.trim(),
      area:                form.area,
      descripcionDetallada: form.descripcionDetallada.trim(),
      proveedor:           form.proveedor.trim(),
      proveedorCodigo:     form.proveedor.trim() ? form.proveedorCodigo : null,
      prioridad:           form.prioridad,
      paradaDePlanta:      form.paradaDePlanta,
      auditoriaInspeccion: form.auditoriaInspeccion,
      tienePresupuesto:    form.tienePresupuesto,
      attachments:         form.attachments
    });
  }

  return (
    <ModalShell
      onClose={onClose}
      title={mode === 'create' ? 'Nueva solicitud' : 'Editar solicitud'}
      subtitle={mode === 'create' ? 'Se creará en «RMA solicitada»' : 'Modificá los datos de la solicitud'}
      size="2xl"
      footer={
        <ModalActions
          onClose={onClose}
          onSubmit={handleSubmit}
          disabled={!canSubmit || uploading}
          submitLabel={mode === 'create' ? 'Crear solicitud' : 'Guardar cambios'}
        />
      }
    >
      <div className="sm:grid sm:grid-cols-5 sm:gap-5 space-y-3 sm:space-y-0">

        {/* Columna izquierda: campos principales */}
        <div className="sm:col-span-3 space-y-3">
          <Field label="Descripción / Título" required>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="Ej: Reposición filtro carbón activado"
              className="form-input"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Solicitante" required>
              <input
                type="text"
                value={form.solicitante}
                onChange={e => setForm({ ...form, solicitante: e.target.value })}
                onBlur={handleSolicitanteBlur}
                placeholder="Nombre completo"
                className="form-input"
              />
            </Field>
            <Field label="Área" required>
              <select
                value={form.area}
                onChange={e => setForm({ ...form, area: e.target.value })}
                className="form-input"
              >
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Descripción detallada">
            <textarea
              value={form.descripcionDetallada}
              onChange={e => setForm({ ...form, descripcionDetallada: e.target.value })}
              placeholder="Especificaciones, contexto, número de serie, motivo..."
              rows={3}
              className="form-input resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Proveedor preferido">
              <ProveedorCombobox
                value={form.proveedor}
                codigo={form.proveedorCodigo}
                proveedores={proveedores}
                loading={loadingProveedores}
                placeholder="Buscar por nombre o código..."
                onChange={({ name, codigo }) =>
                  setForm(f => ({ ...f, proveedor: name, proveedorCodigo: codigo }))
                }
              />
            </Field>
            <Field label="Prioridad">
              <select
                value={form.prioridad}
                onChange={e => setForm({ ...form, prioridad: e.target.value })}
                className="form-input"
              >
                {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.value}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Columna derecha: flags + adjuntos */}
        <div className="sm:col-span-2 space-y-3 sm:border-l sm:border-slate-100 sm:pl-5">
          <div className="space-y-2">
            <label className="flex items-center gap-2 p-2.5 rounded-md border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={form.paradaDePlanta}
                onChange={e => setForm({ ...form, paradaDePlanta: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
              />
              <AlertTriangle size={14} className="text-red-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-900 block leading-tight">Parada de planta</span>
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Afecta operaciones productivas</p>
              </div>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-md border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={form.auditoriaInspeccion}
                onChange={e => setForm({ ...form, auditoriaInspeccion: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-600"
              />
              <ShieldCheck size={14} className="text-violet-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-900 block leading-tight">Auditoría / Inspección</span>
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">Auditoría regulatoria o inspección</p>
              </div>
            </label>

            <label className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer hover:bg-slate-50 ${
              form.tienePresupuesto ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'
            }`}>
              <input
                type="checkbox"
                checked={form.tienePresupuesto}
                onChange={e => setForm({ ...form, tienePresupuesto: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
              />
              <Receipt size={14} className="text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-900 block leading-tight">Ya tengo el presupuesto</span>
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                  {form.tienePresupuesto ? 'Adjuntá el archivo abajo' : 'Marcar si ya lo recibiste'}
                </p>
              </div>
            </label>
          </div>

          <AttachmentsField
            attachments={form.attachments}
            onAdd={handleFiles}
            onRemove={removeAttachment}
            uploading={uploading}
            error={fileError}
            required={form.tienePresupuesto}
            requiredLabel="Adjuntá el presupuesto recibido (obligatorio)"
          />
        </div>
      </div>
    </ModalShell>
  );
}
