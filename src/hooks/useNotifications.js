import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { QUALIFYING_ACTIONS, notifGroupKeyRaw, buildSummary } from '../lib/notifications';

// ─── useNotifications ──────────────────────────────────────────────
// Notificaciones in-app: banner de "hay actualizaciones desde tu última
// visita" + set de claves de grupo calificadas (para el filtro "ver
// actualizadas" del Kanban, armado en App.jsx con acceso a `tasks`).
//
// Reglas (definidas con Leo, jul/2026):
// - Checkpoint por usuario en profiles.notif_checkpoint_at. Cross-device.
//   Se pisa SOLO al interactuar con el banner (dismiss o "ver actualizadas"),
//   nunca en cada mount/refresh (la sesión es persistente).
// - Sin checkpoint previo (null) → sin banner, se planta a now(), fin.
// - Excluye las acciones propias del usuario (user_id <> auth.uid()).
// - Sin límite de antigüedad.
// - Corre UNA vez por sesión/mount (no se re-computa ante cada refresh de
//   `tasks` vía Realtime) — el banner refleja el estado "al entrar a la app".
//
// Esta hook NO conoce `tasks` ni hace la expansión de membership del grupo
// consolidado — eso vive en App.jsx (que ya tiene `tasks` cargado) usando
// `qualifyingGroupKeys` + `notifGroupKey` de lib/notifications.js.

export function useNotifications({ user, enabled = true, onError } = {}) {
  const [loading,     setLoading]     = useState(true);
  const [showBanner,  setShowBanner]  = useState(false);
  const [summary,     setSummary]     = useState({ nuevas: 0, avanzaron: 0, canceladas: 0, total: 0 });
  const [qualifyingGroupKeys, setQualifyingGroupKeys] = useState(() => new Set());

  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const ranRef = useRef(false); // evita doble-fetch en StrictMode / re-renders

  useEffect(() => {
    if (!enabled || !user?.id) {
      setLoading(false);
      return;
    }
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      setLoading(true);

      const { data: profileRow, error: profileErr } = await supabase
        .from('profiles')
        .select('notif_checkpoint_at')
        .eq('id', user.id)
        .single();

      if (profileErr) {
        if (onErrorRef.current) onErrorRef.current(`Notificaciones: ${profileErr.message}`);
        setLoading(false);
        return;
      }

      const checkpoint = profileRow?.notif_checkpoint_at ?? null;

      // Sin baseline previo: sin banner, plantamos checkpoint = ahora, fin.
      if (!checkpoint) {
        await supabase.rpc('touch_notif_checkpoint');
        setLoading(false);
        return;
      }

      const { data: events, error: eventsErr } = await supabase
        .from('history_events')
        .select('solicitud_id, action, at, solicitudes(section, rma_number, oc_number)')
        .in('action', QUALIFYING_ACTIONS)
        .gt('at', checkpoint)
        .neq('user_id', user.id);

      if (eventsErr) {
        if (onErrorRef.current) onErrorRef.current(`Notificaciones: ${eventsErr.message}`);
        setLoading(false);
        return;
      }

      // groupKey -> { action, at } del evento MÁS RECIENTE de ese grupo.
      const latest = new Map();
      for (const row of (events || [])) {
        const sol = Array.isArray(row.solicitudes) ? row.solicitudes[0] : row.solicitudes;
        if (!sol) continue; // fila huérfana (no debería pasar dado el FK)
        const key = notifGroupKeyRaw(row.solicitud_id, sol);
        const prev = latest.get(key);
        if (!prev || new Date(row.at) > new Date(prev.at)) {
          latest.set(key, { action: row.action, at: row.at });
        }
      }

      const actionByGroup = new Map([...latest].map(([k, v]) => [k, v.action]));
      const computedSummary = buildSummary(actionByGroup);

      setQualifyingGroupKeys(new Set(latest.keys()));
      setSummary(computedSummary);
      setShowBanner(computedSummary.total > 0);
      setLoading(false);
    })();
  }, [enabled, user?.id]);

  // Pisa el checkpoint (dismiss del banner o "ver actualizadas"). No borra
  // qualifyingGroupKeys/summary — si el usuario activó el filtro, la sesión
  // actual sigue mostrando ese set ya calculado sin volver a consultar.
  const touchCheckpoint = useCallback(async () => {
    const { error } = await supabase.rpc('touch_notif_checkpoint');
    if (error && onErrorRef.current) {
      onErrorRef.current(`Notificaciones: ${error.message}`);
      return { ok: false, error: error.message };
    }
    setShowBanner(false);
    return { ok: true };
  }, []);

  return {
    loading,
    showBanner,
    summary,
    qualifyingGroupKeys,
    touchCheckpoint
  };
}
