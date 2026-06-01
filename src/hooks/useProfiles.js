import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── useProfiles ──────────────────────────────────────────────────
// Carga la tabla `profiles` (espejo público de auth.users con full_name)
// una vez al montar, y expone `resolveUserName(event)` para mostrar el
// nombre completo en la trazabilidad en vez del username (parte antes del @).
//
// auth.users no es consultable desde el cliente; por eso necesitamos la
// tabla pública `profiles` con RLS de lectura para autenticados.
//
// resolveUserName resuelve por user_id (lo más robusto) y cae a email; si
// no hay perfil, usa el username del email como fallback (comportamiento
// viejo). Acepta el objeto evento del historial ({ userId, userEmail }).
export function useProfiles({ onError } = {}) {
  const [byId,    setById]    = useState({});   // { uuid: {fullName, email, funcion} }
  const [byEmail, setByEmail] = useState({});   // { email_lower: {...} }
  const [loading, setLoading] = useState(true);

  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, funcion');

      if (cancelled) return;

      if (error) {
        console.error('[useProfiles] load failed:', error);
        if (onErrorRef.current) onErrorRef.current(`Cargar perfiles: ${error.message}`);
      } else {
        const id = {}, em = {};
        (data || []).forEach(p => {
          const rec = { fullName: p.full_name || null, email: p.email || null, funcion: p.funcion || null };
          id[p.id] = rec;
          if (p.email) em[p.email.toLowerCase()] = rec;
        });
        setById(id);
        setByEmail(em);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resuelve el nombre a mostrar para un evento de historial.
  const resolveUserName = useCallback((evt) => {
    if (!evt) return '';
    const userId    = evt.userId    ?? evt.user_id    ?? null;
    const userEmail = evt.userEmail ?? evt.user_email ?? null;
    const rec = (userId && byId[userId]) || (userEmail && byEmail[userEmail.toLowerCase()]);
    if (rec?.fullName) return rec.fullName;
    if (userEmail) return userEmail.split('@')[0];  // fallback: username
    return '';
  }, [byId, byEmail]);

  return { profilesLoading: loading, resolveUserName };
}
