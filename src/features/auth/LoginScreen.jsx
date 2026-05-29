import React, { useState, useEffect } from 'react';
import { Package, Loader2, AlertCircle, LogIn } from 'lucide-react';

// Clave de localStorage para recordar el último email usado.
// No se guarda la password — solo el email para evitar reescribirlo cada vez.
const LAST_EMAIL_KEY = 'compras_app_last_email';

export function LoginScreen({ onSignIn }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  // Al montar, recupera el último email usado (si lo hay).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_EMAIL_KEY);
      if (saved) setEmail(saved);
    } catch {
      // localStorage puede no estar disponible (modo incógnito muy estricto)
    }
  }, []);

  async function handleSubmit() {
    if (!email.trim() || !password) return;
    setError(null);
    setLoading(true);
    const result = await onSignIn(email.trim(), password);
    setLoading(false);
    if (!result.ok) {
      setError(traducirError(result.error));
      return;
    }
    // Login OK: guardamos el email para próxima vez.
    try {
      localStorage.setItem(LAST_EMAIL_KEY, email.trim());
    } catch {
      // ignorar
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit();
  }

  const canSubmit = email.trim() && password && !loading;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / título */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-xl bg-slate-900 flex items-center justify-center shadow-sm mb-3">
            <Package size={24} className="text-sky-300" strokeWidth={2.2} />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Gestión de Compras</h1>
          <p className="text-xs text-slate-500 mt-1">Iniciá sesión para continuar</p>
        </div>

        {/* Card del form */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3.5">
          <div>
            <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-600 mb-1.5 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="tu@email.com"
              autoComplete="email"
              autoFocus={!email}
              disabled={loading}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-600 mb-1.5 block">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="••••••••"
              autoComplete="current-password"
              autoFocus={!!email}
              disabled={loading}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600 disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-700 flex items-start gap-1.5">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Entrando...
              </>
            ) : (
              <>
                <LogIn size={14} />
                Iniciar sesión
              </>
            )}
          </button>
        </div>

        <p className="text-[11px] text-slate-400 text-center mt-4">
          Si no tenés cuenta, pedí el alta a tu administrador.
        </p>
      </div>
    </div>
  );
}

// Traduce los mensajes de error de Supabase (en inglés) a texto en español
// amigable para el usuario final. Mantiene el resto del mensaje si no lo conoce.
function traducirError(msg) {
  if (!msg) return 'No se pudo iniciar sesión.';
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials')) {
    return 'Email o contraseña incorrectos.';
  }
  if (m.includes('email not confirmed')) {
    return 'El email todavía no está confirmado. Contactá al administrador.';
  }
  if (m.includes('too many requests') || m.includes('rate limit')) {
    return 'Demasiados intentos. Esperá un momento antes de reintentar.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return 'No se pudo conectar al servidor. Revisá tu conexión.';
  }
  return msg;
}
