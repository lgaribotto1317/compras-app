import React, { useState } from 'react';
import { Lock, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { ModalShell, Field } from '../../components/ModalShell';
import { supabase } from '../../lib/supabase';

// ─── ChangePasswordModal ──────────────────────────────────────────
// Modal para que el usuario cambie su propia contraseña.
//
// Reglas:
//   - Validamos la contraseña actual reintentando un signIn antes de
//     llamar a updateUser. Esto NO es exigido por Supabase (updateUser
//     usa el JWT de la sesión activa para autorizarse), pero le sumamos
//     porque sin verificación previa, si alguien deja la sesión abierta
//     un tercero podría cambiarla sin saber la actual.
//   - La contraseña nueva debe tener mínimo 8 caracteres.
//   - La nueva no puede ser igual a la actual.
//   - Confirmación tiene que coincidir.
//
// Importante: la sesión NO se cierra al cambiar la contraseña. Supabase
// rota el refresh token internamente pero la sesión actual sigue válida.

const MIN_LENGTH = 8;

export function ChangePasswordModal({ user, onClose, onSuccess }) {
  const [current,        setCurrent]        = useState('');
  const [newPass,        setNewPass]        = useState('');
  const [confirm,        setConfirm]        = useState('');
  const [showCurrent,    setShowCurrent]    = useState(false);
  const [showNew,        setShowNew]        = useState(false);
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState(null);

  // Validaciones client-side para feedback inmediato
  const tooShort      = newPass.length > 0 && newPass.length < MIN_LENGTH;
  const sameAsCurrent = newPass.length > 0 && newPass === current;
  const mismatch      = confirm.length > 0 && newPass !== confirm;

  const canSubmit =
    current.length > 0 &&
    newPass.length >= MIN_LENGTH &&
    confirm === newPass &&
    newPass !== current &&
    !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);

    try {
      // Paso 1: verificar contraseña actual con un signIn temporal.
      // Si falla, no avanzamos.
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email:    user.email,
        password: current
      });
      if (signInErr) {
        setError('La contraseña actual no es correcta.');
        setSubmitting(false);
        return;
      }

      // Paso 2: cambiar a la nueva
      const { error: updateErr } = await supabase.auth.updateUser({
        password: newPass
      });
      if (updateErr) {
        setError(`No se pudo cambiar la contraseña: ${updateErr.message}`);
        setSubmitting(false);
        return;
      }

      // OK
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      setError(err?.message || 'Error inesperado al cambiar la contraseña.');
      setSubmitting(false);
    }
  }

  return (
    <ModalShell
      onClose={submitting ? undefined : onClose}
      title="Cambiar contraseña"
      subtitle={user.email}
      footer={
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-[1.5] px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Lock size={14} />
            {submitting ? 'Cambiando...' : 'Cambiar contraseña'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="bg-sky-50 border border-sky-200 rounded-md p-3 flex items-start gap-2.5">
          <Lock size={16} className="text-sky-600 shrink-0 mt-0.5" />
          <div className="text-xs text-sky-900">
            <p className="font-semibold">Cambio de contraseña</p>
            <p className="mt-1">
              Ingresá tu contraseña actual y la nueva. Mínimo {MIN_LENGTH} caracteres.
              No tenés que volver a iniciar sesión.
            </p>
          </div>
        </div>

        <Field label="Contraseña actual" required>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={current}
              onChange={e => setCurrent(e.target.value)}
              autoFocus
              autoComplete="current-password"
              className="form-input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
              tabIndex={-1}
            >
              {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>

        <Field label="Contraseña nueva" required hint={`Mínimo ${MIN_LENGTH} caracteres`}>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              autoComplete="new-password"
              className="form-input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNew(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
              tabIndex={-1}
            >
              {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          {tooShort && (
            <p className="text-[10px] text-red-700 mt-1">La nueva contraseña tiene que tener al menos {MIN_LENGTH} caracteres.</p>
          )}
          {sameAsCurrent && (
            <p className="text-[10px] text-red-700 mt-1">La nueva contraseña no puede ser igual a la actual.</p>
          )}
        </Field>

        <Field label="Confirmar nueva contraseña" required>
          {/* No mostramos toggle de ojo acá — el confirm es solo para verificar
              que la escribió bien. El usuario ya la vio arriba si activó el ojo. */}
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
            className="form-input"
          />
          {mismatch && (
            <p className="text-[10px] text-red-700 mt-1">La confirmación no coincide.</p>
          )}
          {confirm.length > 0 && !mismatch && newPass.length >= MIN_LENGTH && (
            <p className="text-[10px] text-emerald-700 mt-1 inline-flex items-center gap-1">
              <CheckCircle2 size={11} /> Coinciden.
            </p>
          )}
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
