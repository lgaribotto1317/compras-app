// ─── useRealtime ──────────────────────────────────────────────────
// Placeholder para la Vuelta 2 (migración a Supabase).
//
// En Supabase, este hook suscribirá a los cambios de la tabla `solicitudes`
// y de `history_events` usando supabase.channel().on('postgres_changes', ...)
// para que los cambios de un usuario sean visibles en tiempo real para el resto.
//
// Uso esperado en App.jsx (Vuelta 2):
//   useRealtime({ onInsert, onUpdate, onDelete })
//
// En el standalone este hook no hace nada — se deja como contrato de interfaz.

// eslint-disable-next-line no-unused-vars
export function useRealtime({ onInsert, onUpdate, onDelete } = {}) {
  // TODO Vuelta 2: implementar con supabase.channel()
  // Ejemplo:
  //
  // useEffect(() => {
  //   const channel = supabase
  //     .channel('solicitudes-changes')
  //     .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'solicitudes' }, onInsert)
  //     .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'solicitudes' }, onUpdate)
  //     .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'solicitudes' }, onDelete)
  //     .subscribe();
  //   return () => supabase.removeChannel(channel);
  // }, []);
}
