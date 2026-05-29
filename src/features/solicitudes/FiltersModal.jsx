import React, { useState, useRef, useEffect } from 'react';
import {
  Receipt, AlertTriangle, Paperclip, Loader2, FileText,
  AlertCircle, X, Trash2, Search, ShieldCheck, XCircle
} from 'lucide-react';
import { PRIORIDADES, AREAS } from '../../lib/constants';
import { processFile, fmtBytes } from '../../lib/helpers';
import { ModalShell, Field, ModalActions } from '../../components/ModalShell';
import { FilterChip } from '../../components/ui';

// ─── CargarPresupuestoModal ───────────────────────────────────────
export function CargarPresupuestoModal({ task, onClose, onSubmit }) {
  const [attachment, setAttachment] = useState(null);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState(null);
  const inputRef = useRef(null);

  // Ref al attachment actual para el cleanup unmount. Si el usuario cierra
  // el modal sin submitear (o después de submitear), revocamos la previewUrl
  // local del Blob para no leakear memoria.
  const attachmentRef = useRef(attachment);
  useEffect(() => { attachmentRef.current = attachment; }, [attachment]);
  useEffect(() => {
    return () => {
      const a = attachmentRef.current;
      if (a?.previewUrl) {
        try { URL.revokeObjectURL(a.previewUrl); } catch { /* ignorar */ }
      }
    };
  }, []);

  async function handleFile(file) {
    setError(null);
    setUploading(true);
    try {
      setAttachment(await processFile(file));
    } catch (err) {
      setError(err.message || `Error al procesar "${file.name}"`);
    } finally {
      setUploading(false);
    }
  }

  const canSubmit = attachment !== null && !uploading;

  return (
    <ModalShell
      onClose={onClose}
      title="Cargar presupuesto"
      subtitle={`Solicitud ${task.numero || ''} · ${task.name}`}
    >
      <div className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3 flex items-start gap-2.5">
          <Receipt size={16} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900">
            <p className="font-semibold">Subí el archivo del presupuesto del proveedor.</p>
            <p className="mt-1">
              Una vez confirmado, queda registrado el timestamp exacto y empieza a contar para la métrica de antigüedad.
            </p>
          </div>
        </div>

        <Field label="Archivo del presupuesto" required>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) { handleFile(file); e.target.value = ''; }
            }}
          />
          {!attachment ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 px-3 py-3 border-2 border-dashed border-emerald-300 rounded-md text-sm text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50/50 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
              {uploading ? 'Procesando...' : 'Seleccionar archivo'}
            </button>
          ) : (
            <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-md">
              {attachment.isImage ? (
                <img src={attachment.previewUrl} alt={attachment.name} className="w-10 h-10 rounded object-cover border border-emerald-200" />
              ) : (
                <div className="w-10 h-10 rounded bg-white border border-emerald-200 flex items-center justify-center shrink-0">
                  <FileText size={18} className="text-emerald-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">{attachment.name}</p>
                <p className="font-mono text-[10px] text-slate-500">{fmtBytes(attachment.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  // Revocar previewUrl antes de descartar el attachment
                  if (attachment.previewUrl) {
                    try { URL.revokeObjectURL(attachment.previewUrl); } catch { /* ignorar */ }
                  }
                  setAttachment(null);
                }}
                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </Field>

        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start gap-1.5">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors">
          Cancelar
        </button>
        <button
          onClick={() => onSubmit(attachment)}
          disabled={!canSubmit}
          className="flex-[1.5] px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Receipt size={14} />
          Cargar presupuesto
        </button>
      </div>
    </ModalShell>
  );
}

// ─── QuitarPresupuestoModal ───────────────────────────────────────
export function QuitarPresupuestoModal({ task, onClose, onSubmit }) {
  const [motivo, setMotivo] = useState('');

  return (
    <ModalShell
      onClose={onClose}
      title="Quitar presupuesto"
      subtitle={`Solicitud ${task.numero || ''} · ${task.name}`}
    >
      <div className="space-y-4">
        <div className="bg-orange-50 border border-orange-200 rounded-md p-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-orange-600 shrink-0 mt-0.5" />
          <div className="text-xs text-orange-900">
            <p className="font-semibold">Esta acción queda registrada.</p>
            <p className="mt-1">
              El adjunto NO se borra. La solicitud va a quedar marcada como sin presupuesto
              y va a volver a contar para la métrica de antigüedad.
            </p>
          </div>
        </div>

        <Field label="Motivo (opcional)" hint="Para referencia futura. Va a quedar en el historial.">
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ej: presupuesto vencido, proveedor cambió, etc."
            rows={3}
            className="form-input resize-none"
          />
        </Field>
      </div>

      <div className="flex gap-2 mt-5 pt-4 border-t border-slate-100">
        <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors">
          Cancelar
        </button>
        <button
          onClick={() => onSubmit(motivo.trim() || null)}
          className="flex-[1.5] px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-md transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 size={14} />
          Quitar presupuesto
        </button>
      </div>
    </ModalShell>
  );
}

// ─── FiltersModal ─────────────────────────────────────────────────
export function FiltersModal({
  search, setSearch,
  filterPrioridad, setFilterPrioridad,
  filterArea, setFilterArea,
  filterParada, setFilterParada,
  filterAuditoria, setFilterAuditoria,
  includeCancelled, setIncludeCancelled,
  onClose, onClear
}) {
  return (
    <ModalShell
      onClose={onClose}
      title="Filtros y búsqueda"
      subtitle="Refiná las solicitudes que ves"
      footer={
        <div className="flex gap-2">
          <button
            onClick={onClear}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          >
            Limpiar
          </button>
          <button
            onClick={onClose}
            className="flex-[1.5] px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-md transition-colors"
          >
            Aplicar
          </button>
        </div>
      }
    >
      <div className="space-y-3.5">
        <Field label="Búsqueda">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre, área, proveedor, RMA, OC..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
              autoFocus
            />
          </div>
        </Field>

        <Field label="Prioridad">
          <div className="flex gap-1.5 flex-wrap">
            <FilterChip active={!filterPrioridad} onClick={() => setFilterPrioridad('')} label="Todas" />
            {PRIORIDADES.map(p => (
              <FilterChip
                key={p.value}
                active={filterPrioridad === p.value}
                onClick={() => setFilterPrioridad(p.value)}
                label={p.value}
                dot={p.dot}
              />
            ))}
          </div>
        </Field>

        <Field label="Área">
          <div className="flex gap-1.5 flex-wrap">
            <FilterChip active={!filterArea} onClick={() => setFilterArea('')} label="Todas" />
            {AREAS.map(a => (
              <FilterChip key={a} active={filterArea === a} onClick={() => setFilterArea(a)} label={a} />
            ))}
          </div>
        </Field>

        {/* Toggles de flags — 2 estados (todas / solo con). Combinables entre sí y con los demás filtros. */}
        <Field label="Flags">
          <div className="space-y-2">
            <label className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer hover:bg-slate-50 transition-colors ${
              filterParada ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
            }`}>
              <input
                type="checkbox"
                checked={filterParada}
                onChange={e => setFilterParada(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-600"
              />
              <AlertTriangle size={14} className="text-red-600 shrink-0" />
              <span className="text-sm font-medium text-slate-900 leading-tight">Solo con parada de planta</span>
            </label>

            <label className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer hover:bg-slate-50 transition-colors ${
              filterAuditoria ? 'border-violet-300 bg-violet-50/30' : 'border-slate-200'
            }`}>
              <input
                type="checkbox"
                checked={filterAuditoria}
                onChange={e => setFilterAuditoria(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-600"
              />
              <ShieldCheck size={14} className="text-violet-600 shrink-0" />
              <span className="text-sm font-medium text-slate-900 leading-tight">Solo con auditoría/inspección</span>
            </label>

            {/* Bloque 4: toggle de canceladas. Por default off → Kanban
                no muestra canceladas. Activarlo las incluye en Kanban
                y Dashboard. */}
            <label className={`flex items-center gap-2 p-2.5 rounded-md border cursor-pointer hover:bg-slate-50 transition-colors ${
              includeCancelled ? 'border-slate-400 bg-slate-100' : 'border-slate-200'
            }`}>
              <input
                type="checkbox"
                checked={!!includeCancelled}
                onChange={e => setIncludeCancelled(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-slate-600 focus:ring-slate-600"
              />
              <XCircle size={14} className="text-slate-500 shrink-0" />
              <span className="text-sm font-medium text-slate-900 leading-tight">Incluir solicitudes canceladas</span>
            </label>
          </div>
        </Field>
      </div>
    </ModalShell>
  );
}
