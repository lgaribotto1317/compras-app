import React, { useState } from 'react';
import { XCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { ModalShell, Field } from '../../components/ModalShell';
import { SECTION_BY_ID } from '../../lib/constants';

// ─── CancelarSolicitudModal ───────────────────────────────────────
// Modal para cancelar una solicitud. Motivo obligatorio (mínimo 10
// caracteres después de trim, para evitar "ok", "no", etc.).
//
// Decisión B2: una vez cancelada NO se puede descancelar. El trigger
// Postgres también lo bloquea, esto es solo el aviso al usuario para
// que confirme.
//
// La cancelación NO cambia la `section`. La solicitud queda en su
// sección actual con `cancelled_at` seteado. El Kanban la oculta por
// default (decisión A1).

const MIN_MOTIVO_CHARS = 10;

export function CancelarSolicitudModal({ task, onClose, onSubmit }) {
  const [motivo, setMotivo]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState(null);

  const trimmed   = motivo.trim();
  const canSubmit = trimmed.length >= MIN_MOTIVO_CHARS && !submitting;
  const section   = SECTION_BY_ID[task.section];

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      // Si onSubmit resuelve OK, el caller (App.jsx) cierra el modal.
      // Si lanza error, lo capturamos abajo. No reseteamos `submitting`
      // si fue OK porque el modal va a desmontarse.
    } catch (err) {
      setError(err?.message || 'No se pudo cancelar la solicitud.');
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      onClose={submitting ? undefined : onClose}
      title="Cancelar solicitud"
      subtitle={`${task.numero || ''} · ${task.name}`}
      footer={
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
          >
            Volver
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-[1.5] px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <XCircle size={14} />
            {submitting ? 'Cancelando...' : 'Cancelar solicitud'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Banner de advertencia: la cancelación es irreversible (B2) */}
        <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs text-red-900">
            <p className="font-semibold">Esta acción no se puede deshacer.</p>
            <p className="mt-1">
              La solicitud va a quedar marcada como cancelada y oculta del Kanban.
              Si fue por error, vas a tener que crear una solicitud nueva.
            </p>
          </div>
        </div>

        {/* Resumen del contexto: para que el usuario confirme que está
            cancelando la que quería (más útil cuando el motivo se escribe
            mirando otro tab). */}
        <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs space-y-1">
          <p><span className="text-slate-500">Solicitante:</span> <span className="font-medium text-slate-900">{task.solicitante || '—'}</span></p>
          <p><span className="text-slate-500">Área:</span> <span className="font-medium text-slate-900">{task.area || '—'}</span></p>
          {section && (
            <p>
              <span className="text-slate-500">Estado actual:</span>{' '}
              <span className={`px-1.5 py-0.5 rounded font-medium ${section.chip} text-[10px]`}>{section.name}</span>
            </p>
          )}
        </div>

        <Field
          label="Motivo de cancelación"
          required
          hint={`Mínimo ${MIN_MOTIVO_CHARS} caracteres. Va a quedar en la trazabilidad.`}
        >
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            placeholder="Ej: el proveedor no puede entregar en plazo y se reemplaza por solicitud #..."
            rows={4}
            autoFocus
            className="form-input resize-none"
          />
          <p className="text-[10px] text-slate-400 mt-1 font-mono">
            {trimmed.length}/{MIN_MOTIVO_CHARS} caracteres mínimo
          </p>
        </Field>

        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start gap-1.5">
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
