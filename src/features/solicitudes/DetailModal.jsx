import React, { useState, useEffect } from 'react';
import {
  User, Building2, Truck, AlertTriangle, ShieldCheck, Clock, Receipt,
  ChevronRight, FileText, Eye, Download, Trash2, Edit2,
  Plus, ShoppingCart, CheckCircle2, Paperclip, X, Loader2, XCircle, DollarSign, Layers
} from 'lucide-react';
import { SECTION_BY_ID, PRIORIDADES, FLOW_STEPS } from '../../lib/constants';
import { fmtDate, fmtBytes, timeAgo } from '../../lib/helpers';
import { getSignedUrl, downloadAttachment } from '../../lib/supabase';
import { ModalShell } from '../../components/ModalShell';

// ─── HistoryEntry ─────────────────────────────────────────────────
function HistoryEntry({ event, resolveUserName }) {
  const fromSec = event.from ? SECTION_BY_ID[event.from] : null;
  const toSec   = event.to   ? SECTION_BY_ID[event.to]   : null;

  const iconMap = {
    'creada':                  { icon: Plus,          color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    'creada con presupuesto':  { icon: Plus,          color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    'Generar RMA':             { icon: Receipt,       color: 'text-sky-600 bg-sky-50 border-sky-200' },
    'Valorizar RMA':           { icon: DollarSign,    color: 'text-teal-600 bg-teal-50 border-teal-200' },
    'Generar OC':              { icon: ShoppingCart,  color: 'text-violet-600 bg-violet-50 border-violet-200' },
    'Finalizar compra':        { icon: CheckCircle2,  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    'editada':                 { icon: Edit2,         color: 'text-slate-600 bg-slate-50 border-slate-200' },
    'archivo agregado':        { icon: Paperclip,     color: 'text-slate-600 bg-slate-50 border-slate-200' },
    'archivo eliminado':       { icon: Trash2,        color: 'text-slate-600 bg-slate-50 border-slate-200' },
    'presupuesto cargado':     { icon: Receipt,       color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    'presupuesto removido':    { icon: Receipt,       color: 'text-orange-600 bg-orange-50 border-orange-200' },
    'factura/comentarios actualizados': { icon: FileText, color: 'text-violet-600 bg-violet-50 border-violet-200' },
    'cancelada':               { icon: XCircle,       color: 'text-red-700 bg-red-50 border-red-200' },
    'eliminada':               { icon: Trash2,        color: 'text-red-700 bg-red-50 border-red-200' }
  };
  const cfg = iconMap[event.action] || iconMap['editada'];
  const I   = cfg.icon;

  return (
    <div className="flex items-start gap-2.5 text-xs">
      <div className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 ${cfg.color}`}>
        <I size={11} strokeWidth={2.3} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-slate-800">{event.action}</span>
          {event.userEmail && (
            // Nombre completo desde profiles (fallback: username antes del @).
            // El email completo queda en el title por si se quiere ver con hover.
            <span
              className="text-[10px] text-slate-500 font-medium"
              title={event.userEmail}
            >
              · {resolveUserName ? resolveUserName(event) : event.userEmail.split('@')[0]}
            </span>
          )}
          {fromSec && toSec && (
            <>
              <span className={`px-1.5 py-0.5 rounded font-medium ${fromSec.chip} text-[10px]`}>{fromSec.short}</span>
              <ChevronRight size={9} className="text-slate-400" />
              <span className={`px-1.5 py-0.5 rounded font-medium ${toSec.chip} text-[10px]`}>{toSec.short}</span>
            </>
          )}
        </div>
        {/* Eventos nuevos: lista de cambios con valor anterior → nuevo */}
        {event.changes?.length > 0 ? (
          <ul className="text-[11px] text-slate-600 mt-1 space-y-0.5">
            {event.changes.map((c, i) => (
              <li key={i} className="leading-snug">
                <span className="font-medium text-slate-700">{c.label}:</span>{' '}
                <span className="text-slate-500">{c.before}</span>
                <span className="text-slate-400 mx-1">→</span>
                <span className="text-slate-800">{c.after}</span>
              </li>
            ))}
          </ul>
        ) : event.fieldsChanged?.length > 0 && (
          /* Retrocompat: eventos viejos solo guardan fieldsChanged */
          <p className="text-[11px] text-slate-500 mt-0.5">Modificó: {event.fieldsChanged.join(', ')}</p>
        )}
        {event.attachmentName && (
          <p className="text-[11px] text-slate-500 mt-0.5 font-mono truncate">{event.attachmentName}</p>
        )}
        {event.motivo && (
          <p className="text-[11px] text-slate-600 mt-0.5 italic">Motivo: {event.motivo}</p>
        )}
        {(() => {
          const consol = event.values && event.values._consolidacion;
          const genericValues = event.values
            ? Object.entries(event.values).filter(([k, v]) => v && k !== '_consolidacion')
            : [];
          return (
            <>
              {consol && (
                <p className="text-[11px] text-sky-700 mt-0.5 flex items-start gap-1">
                  <Layers size={11} className="shrink-0 mt-0.5" />
                  <span>
                    Consolidó {consol.count} {consol.nivel === 'rma' ? 'RMA' : 'solicitudes'}:{' '}
                    <span className="font-mono">{consol.numeros.join(', ')}</span>
                  </span>
                </p>
              )}
              {genericValues.length > 0 && (
                <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                  {genericValues.map(([k, v]) => `${k}: ${v}`).join(' · ')}
                </p>
              )}
            </>
          );
        })()}
        <p className="font-mono text-[10px] text-slate-400 mt-0.5">{fmtDate(event.at)} · {timeAgo(event.at)}</p>
      </div>
    </div>
  );
}

// ─── DetailRow ────────────────────────────────────────────────────
function DetailRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon size={13} className="text-slate-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">{label}</span>
        <span className="text-slate-900">{value}</span>
      </div>
    </div>
  );
}

// ─── DetailModal ──────────────────────────────────────────────────
// Props:
//   - canCancel:  ¿muestro botón "Cancelar"?
//   - canDelete:  ¿muestro botón "Eliminar"? (solo admin)
//   - canEdit:    ¿muestro botón "Editar"? (según rol y sección)
//   - canAdvance: ¿muestro botón de avance ("Generar RMA"/"OC"/"Finalizar")?
//   - canBudget:  ¿muestro botones de presupuesto en RMA solicitada?
export function DetailModal({
  task, onClose, onEdit, onDelete, onAdvance, onCancel,
  onCargarPresupuesto, onQuitarPresupuesto,
  onGuardarFactura,
  canCancel = false, canDelete = false, canEdit = false,
  canAdvance = false, canBudget = false, canEditFactura = false,
  resolveUserName,
  groupRows = null, onSelectMember
}) {
  const section     = SECTION_BY_ID[task.section];
  const isFinal     = task.section === 'finalizadas';
  const prioCfg     = PRIORIDADES.find(p => p.value === task.prioridad);
  const Icon        = section.icon;
  const attachments = task.attachments || [];
  const enSolicitada = task.section === 'rma_solicitada';
  const isCancelled  = !!task.cancelledAt;

  const [previewAtt, setPreviewAtt] = useState(null);
  // Cache de signed URLs (1h) para los attachments imagen. Se carga on-mount
  // y queda viva hasta que el modal se cierra (suficiente para uso normal).
  // Map { [att.id]: signedUrl }.
  const [signedUrls, setSignedUrls] = useState({});
  // Loading flag de descargas — para mostrar spinner en el botón mientras
  // se pide la signed URL corta antes de navegar.
  const [downloadingId, setDownloadingId] = useState(null);

  // Punto 4: panel editable de factura/comentarios OC. Aparece desde
  // oc_generada en adelante. El estado local arranca con lo que hay en DB
  // y se sincroniza si cambia la task (ej. realtime de otro usuario).
  const showFacturaPanel = ['oc_generada', 'finalizadas'].includes(task.section);
  const [facturaForm, setFacturaForm] = useState({
    numeroFactura: task.numeroFactura || '',
    comentariosOc: task.comentariosOc || ''
  });
  const [savingFactura, setSavingFactura] = useState(false);
  useEffect(() => {
    setFacturaForm({
      numeroFactura: task.numeroFactura || '',
      comentariosOc: task.comentariosOc || ''
    });
  }, [task.id, task.numeroFactura, task.comentariosOc]);

  const facturaDirty =
    (facturaForm.numeroFactura || '') !== (task.numeroFactura || '') ||
    (facturaForm.comentariosOc || '') !== (task.comentariosOc || '');

  async function handleSaveFactura() {
    if (!onGuardarFactura || !facturaDirty) return;
    setSavingFactura(true);
    try {
      await onGuardarFactura(task.id, {
        numeroFactura: facturaForm.numeroFactura.trim(),
        comentariosOc: facturaForm.comentariosOc.trim()
      });
    } finally {
      setSavingFactura(false);
    }
  }

  useEffect(() => {
    // Pedir signed URL larga para cada attachment imagen al abrir el modal.
    // Las no-imagen no necesitan preview, se generan al click de descarga.
    const imageAttachments = attachments.filter(a => a.isImage && a.storagePath);
    if (imageAttachments.length === 0) return;
    let cancelled = false;
    (async () => {
      const updates = {};
      for (const att of imageAttachments) {
        const url = await getSignedUrl(att.storagePath);
        if (url) updates[att.id] = url;
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setSignedUrls(prev => ({ ...prev, ...updates }));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);   // refrescar solo si cambia la solicitud, no en cada render

  // Handler de click sobre un attachment.
  // - Imagen: abre preview full-screen usando la signed URL cacheada.
  // - No imagen: pide signed URL corta y dispara descarga.
  async function handleAttachmentClick(att) {
    if (att.isImage) {
      const url = signedUrls[att.id];
      if (!url) return; // todavía cargando, no hacer nada
      setPreviewAtt({ ...att, signedUrl: url });
      return;
    }
    setDownloadingId(att.id);
    try {
      await downloadAttachment(att);
    } catch (err) {
      console.error('[DetailModal] descarga falló:', err);
      // Sin toast por ahora — el error queda en console. Si se vuelve común
      // se puede propagar via callback al App.
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <ModalShell onClose={onClose} title="Detalle de solicitud" hideTitle>
      <div className="-mt-2">

        {/* Bloque 4: banner de cancelación. Si la solicitud está cancelada,
            la información de cancelación va arriba de todo, antes que cualquier
            otra cosa, para que sea imposible de pasar por alto. */}
        {isCancelled && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3">
            <div className="flex items-center gap-2 mb-1.5">
              <XCircle size={14} className="text-red-700 shrink-0" />
              <span className="text-xs font-bold text-red-900 uppercase tracking-wider">Solicitud cancelada</span>
              <span className="font-mono text-[10px] text-red-700 ml-auto">{fmtDate(task.cancelledAt)}</span>
            </div>
            {task.cancellationReason && (
              <p className="text-xs text-red-900 italic pl-6">
                Motivo: {task.cancellationReason}
              </p>
            )}
          </div>
        )}

        {/* Sección + número */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded font-medium text-[11px] ${section.chip}`}>
            <Icon size={12} />
            {section.name}
          </div>
          {task.numero && (
            <span className="font-mono text-xs text-slate-500 font-semibold tabular-nums">{task.numero}</span>
          )}
        </div>

        <h3 className="text-xl font-semibold text-slate-900 leading-tight mb-3">{task.name}</h3>

        {/* Composición del grupo (consolidación N→1). Solo si el detalle se
            abrió sobre un grupo de 2+ solicitudes que comparten número. Lista
            navegable: clic en un miembro cambia la solicitud vista. Solo-lectura
            (sacar miembros queda para una iteración posterior). */}
        {groupRows && groupRows.length > 1 && (
          <div className="bg-sky-50/60 border border-sky-200 rounded-md p-3 mb-4">
            <p className="text-[10px] uppercase tracking-wider text-sky-800 font-semibold mb-2 flex items-center gap-1.5">
              <Layers size={12} /> Composición del grupo · {groupRows.length} solicitudes
            </p>
            <div className="space-y-1">
              {groupRows.map(m => {
                const isCurrent = m.id === task.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => { if (!isCurrent) onSelectMember && onSelectMember(m); }}
                    disabled={isCurrent}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${
                      isCurrent
                        ? 'bg-white border border-sky-300 cursor-default'
                        : 'bg-transparent hover:bg-white border border-transparent hover:border-sky-200'
                    }`}
                  >
                    <span className="font-mono text-[10px] text-slate-500 font-semibold shrink-0 tabular-nums">{m.numero || '—'}</span>
                    <span className="flex-1 min-w-0 truncate text-slate-800">{m.name}</span>
                    {isCurrent
                      ? <span className="text-[9px] uppercase tracking-wider text-sky-700 font-bold shrink-0">viendo</span>
                      : <ChevronRight size={12} className="text-slate-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Badges destacados */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {enSolicitada && !task.tienePresupuesto && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-1 rounded">
              <Clock size={12} /> Sin presupuesto
            </span>
          )}
          {enSolicitada && task.tienePresupuesto && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">
              <Receipt size={12} /> Presupuestada
            </span>
          )}
          {task.paradaDePlanta && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
              <AlertTriangle size={12} /> Parada de planta
            </span>
          )}
          {task.auditoriaInspeccion && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-1 rounded">
              <ShieldCheck size={12} /> Auditoría / Inspección
            </span>
          )}
        </div>

        {/* Identificadores RMA / CMA / OMA */}
        {(task.rmaNumber || task.cmaNumber || task.ocNumber) && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {task.rmaNumber && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-sky-50 text-sky-800 border border-sky-200">
                <Receipt size={11} /> RMA · {task.rmaNumber}
              </span>
            )}
            {task.cmaNumber && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-teal-50 text-teal-800 border border-teal-200">
                <DollarSign size={11} /> CMA · {task.cmaNumber}
              </span>
            )}
            {task.ocNumber && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-violet-50 text-violet-800 border border-violet-200">
                <ShoppingCart size={11} /> OMA · {task.ocNumber}
              </span>
            )}
          </div>
        )}

        {/* Info */}
        <div className="space-y-3 mb-5">
          <DetailRow icon={User}          label="Solicitante"       value={task.solicitante} />
          <DetailRow icon={Building2}     label="Área"              value={task.area} />
          <DetailRow
            icon={Truck}
            label="Proveedor preferido"
            value={task.proveedor ? (
              <span>
                {task.proveedor}
                {task.proveedorCodigo && (
                  <span className="ml-1.5 font-mono text-[10px] text-slate-400">· cód. {task.proveedorCodigo}</span>
                )}
              </span>
            ) : null}
          />
          {task.proveedorAdjudicado && (
            <DetailRow
              icon={Truck}
              label="Proveedor adjudicado"
              value={
                <span className="font-medium text-violet-800">
                  {task.proveedorAdjudicado}
                  {task.proveedorAdjudicadoCodigo && (
                    <span className="ml-1.5 font-mono text-[10px] text-violet-400 font-normal">· cód. {task.proveedorAdjudicadoCodigo}</span>
                  )}
                </span>
              }
            />
          )}
          {prioCfg && (
            <DetailRow
              icon={AlertTriangle}
              label="Prioridad"
              value={
                <span className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[11px] font-semibold border ${prioCfg.chip}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${prioCfg.dot}`}></span>
                  {task.prioridad}
                </span>
              }
            />
          )}
          {task.monto      && <DetailRow icon={Receipt}  label="Monto"        value={<span className="font-mono">{task.monto}</span>} />}
          {task.numeroFactura && <DetailRow icon={FileText} label="N° Factura"   value={<span className="font-mono">{task.numeroFactura}</span>} />}
          {task.fechaCierre && <DetailRow icon={Receipt}  label="Fecha cierre" value={<span className="font-mono">{task.fechaCierre}</span>} />}
        </div>

        {task.descripcionDetallada && (
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Descripción</p>
            <p className="text-sm text-slate-700 whitespace-pre-line">{task.descripcionDetallada}</p>
          </div>
        )}

        {task.observaciones && (
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Observaciones</p>
            <p className="text-sm text-slate-700 whitespace-pre-line bg-slate-50 rounded-md p-3 border border-slate-200">
              {task.observaciones}
            </p>
          </div>
        )}

        {task.comentariosRma && (
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1.5">Comentarios RMA</p>
            <p className="text-sm text-slate-700 whitespace-pre-line bg-slate-50 rounded-md p-3 border border-slate-200">
              {task.comentariosRma}
            </p>
          </div>
        )}

        {/* Punto 4: Factura + comentarios OC. Editable si canEditFactura;
            si no, lectura (solo si hay algo cargado). */}
        {showFacturaPanel && (canEditFactura || task.numeroFactura || task.comentariosOc) && (
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2 flex items-center gap-1.5">
              <FileText size={12} /> Facturación
            </p>
            {canEditFactura && !isCancelled ? (
              <div className="space-y-2.5 bg-slate-50 rounded-md p-3 border border-slate-200">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Número de factura</label>
                  <input
                    type="text"
                    value={facturaForm.numeroFactura}
                    onChange={e => setFacturaForm(f => ({ ...f, numeroFactura: e.target.value }))}
                    placeholder="Ej: 0001-00012345"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Comentarios</label>
                  <textarea
                    value={facturaForm.comentariosOc}
                    onChange={e => setFacturaForm(f => ({ ...f, comentariosOc: e.target.value }))}
                    placeholder="Información adicional sobre la factura o la OC..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveFactura}
                    disabled={!facturaDirty || savingFactura}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {savingFactura ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 bg-slate-50 rounded-md p-3 border border-slate-200">
                {task.numeroFactura && (
                  <p className="text-sm text-slate-700">
                    <span className="text-[11px] text-slate-500">N° Factura: </span>
                    <span className="font-mono">{task.numeroFactura}</span>
                  </p>
                )}
                {task.comentariosOc && (
                  <p className="text-sm text-slate-700 whitespace-pre-line">
                    <span className="text-[11px] text-slate-500 block mb-0.5">Comentarios:</span>
                    {task.comentariosOc}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Adjuntos */}
        {attachments.length > 0 && (
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
              Adjuntos ({attachments.length})
            </p>
            <div className="grid grid-cols-2 gap-2">
              {attachments.map(a => {
                const thumbUrl = a.isImage ? signedUrls[a.id] : null;
                const isDownloading = downloadingId === a.id;
                const isPresupuesto = a.tipo === 'presupuesto';
                return (
                  <button
                    key={a.id}
                    onClick={() => handleAttachmentClick(a)}
                    disabled={isDownloading || (a.isImage && !thumbUrl)}
                    className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-md text-left transition-colors group disabled:opacity-60 disabled:cursor-wait"
                    title={isPresupuesto ? 'Presupuesto adjunto' : a.name}
                  >
                    {a.isImage && thumbUrl ? (
                      <img src={thumbUrl} alt={a.name} className="w-9 h-9 rounded object-cover border border-slate-200 shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        {a.isImage ? (
                          <Loader2 size={14} className="animate-spin text-slate-400" />
                        ) : (
                          <FileText size={16} className={isPresupuesto ? 'text-emerald-600' : 'text-slate-500'} />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">{a.name}</p>
                      <p className="font-mono text-[10px] text-slate-500">
                        {fmtBytes(a.size)}
                        {isPresupuesto && <span className="ml-1.5 text-emerald-700 font-semibold">· presupuesto</span>}
                      </p>
                    </div>
                    {isDownloading ? (
                      <Loader2 size={13} className="animate-spin text-slate-400 shrink-0" />
                    ) : a.isImage ? (
                      <Eye size={13} className="text-slate-400 group-hover:text-slate-700 shrink-0" />
                    ) : (
                      <Download size={13} className="text-slate-400 group-hover:text-slate-700 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Fechas: creada / editada */}
        <p className="font-mono text-[10px] text-slate-400 mb-4">
          Creada {fmtDate(task.createdAt)}
          {task.updatedAt !== task.createdAt && ` · Editada ${fmtDate(task.updatedAt)}`}
        </p>

        {/* Acciones presupuesto — solo si el user tiene permiso (canBudget) */}
        {enSolicitada && !isCancelled && canBudget && (onCargarPresupuesto || onQuitarPresupuesto) && (
          <div className="flex gap-2 pt-3 border-t border-slate-100">
            {!task.tienePresupuesto && onCargarPresupuesto && (
              <button
                onClick={onCargarPresupuesto}
                className="flex-1 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5"
              >
                <Receipt size={14} /> Cargar presupuesto
              </button>
            )}
            {task.tienePresupuesto && onQuitarPresupuesto && (
              <button
                onClick={onQuitarPresupuesto}
                className="flex-1 px-3 py-2.5 text-sm font-medium text-orange-700 bg-white hover:bg-orange-50 border border-orange-200 rounded-md transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 size={14} /> Quitar presupuesto
              </button>
            )}
          </div>
        )}

        {/* Acciones principales — siempre antes de la trazabilidad para que
            queden accesibles en todas las secciones. Si la solicitud está
            cancelada, solo se muestran las que tengan sentido (edit / eliminar
            para admin; no se puede avanzar ni cancelar de nuevo). */}
        <div className="flex gap-2 pt-4 border-t border-slate-100">
          {/* Eliminar (soft delete): solo admin */}
          {canDelete && (
            <button
              onClick={onDelete}
              className="px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1.5"
              title="Eliminar (soft delete)"
            >
              <Trash2 size={14} />
            </button>
          )}

          {/* Editar: solo si canEdit y no está cancelada */}
          {canEdit && !isCancelled && (
            <button
              onClick={onEdit}
              className="flex-1 px-3 py-2.5 text-sm font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors flex items-center justify-center gap-1.5"
            >
              <Edit2 size={14} /> Editar
            </button>
          )}

          {/* Cancelar solicitud: solo si canCancel y no está cancelada/finalizada */}
          {canCancel && !isCancelled && !isFinal && (
            <button
              onClick={onCancel}
              className="px-3 py-2.5 text-sm font-medium text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-md transition-colors flex items-center justify-center gap-1.5"
              title="Cancelar solicitud"
            >
              <XCircle size={14} /> Cancelar
            </button>
          )}

          {/* Avanzar: solo si canAdvance (y no es finalizada/cancelada — ya
              implícito en canAdvance) */}
          {canAdvance && !isFinal && !isCancelled && (
            <button
              onClick={onAdvance}
              className={`flex-[1.5] px-3 py-2.5 ${section.btn} text-white text-sm font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5`}
            >
              {FLOW_STEPS[task.section].label}
              <ChevronRight size={14} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Trazabilidad — siempre al fondo, en todas las secciones */}
        {task.history?.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
              Trazabilidad ({task.history.length} {task.history.length === 1 ? 'evento' : 'eventos'})
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {task.history.slice().reverse().map((h, i) => (
                <HistoryEntry key={i} event={h} resolveUserName={resolveUserName} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Preview de imagen */}
      {previewAtt && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/90 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewAtt(null)}
        >
          <button
            onClick={() => setPreviewAtt(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-md text-white"
          >
            <X size={20} />
          </button>
          <img src={previewAtt.signedUrl} alt={previewAtt.name} className="max-w-full max-h-full object-contain rounded-md" />
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-xs text-white bg-slate-900/80 px-3 py-1.5 rounded-md">
            {previewAtt.name} · {fmtBytes(previewAtt.size)}
          </p>
        </div>
      )}
    </ModalShell>
  );
}
