import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ─── useRealtime ──────────────────────────────────────────────────
// Suscribe a los cambios de `solicitudes`, `history_events` y `attachments`
// vía supabase.channel('...').on('postgres_changes', ...) para que lo que
// hace un usuario se vea en vivo en el resto sin recargar la página.
//
// Versión simple (acordada): ante CUALQUIER evento (INSERT/UPDATE/DELETE en
// cualquiera de las 3 tablas) se dispara `onChange` con un debounce de ~350ms,
// para no recargar N veces si entran varios eventos juntos (ej. una solicitud
// + sus adjuntos + su evento de historial llegan casi simultáneos).
// `onChange` típicamente es el `reload` (loadAll) de useSolicitudes.
//
// Notas:
// - La RLS aplica también a Realtime: cada cliente recibe solo eventos de
//   filas que puede ver (hoy: todos los autenticados ven todo).
// - Eco de los propios cambios: el usuario que hizo la acción también recibe
//   el evento y dispara un reload extra. Es inofensivo (ya tenía el estado
//   actualizado); el debounce lo absorbe. Si molesta, se optimiza después
//   filtrando por el propio user_id o parcheando el estado en vez de recargar.
//
// onChange se guarda en un ref para no re-suscribir el canal en cada render
// (loadAll cambia de identidad cuando cambian sus deps).
export function useRealtime({ onChange, enabled = true } = {}) {
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!enabled) return;

    let timer = null;
    const fire = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { onChangeRef.current?.(); }, 350);
    };

    const channel = supabase
      .channel('compras-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes' },   fire)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'history_events' }, fire)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments' },    fire)
      .subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [enabled]);
}
