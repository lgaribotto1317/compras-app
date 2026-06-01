import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ─── useProveedores ──────────────────────────────────────────────
// Carga la lista de proveedores activos (tabla `proveedores`) UNA sola
// vez al montar. La lista cambia muy de vez en cuando, así que no hace
// falta Realtime: si se actualiza el maestro, alcanza con recargar la
// página. ~730 filas × 2 campos ≈ 35KB, una query liviana.
//
// Devuelve { proveedores, loadingProveedores }.
//   - proveedores: [{ codigo, legalName }] ordenado por legalName.
//   - loadingProveedores: true mientras resuelve la query inicial.
//
// onError (opcional): callback para reportar fallos vía toast. Se guarda
// en un ref para no re-disparar el efecto (que corre una sola vez).
export function useProveedores({ onError } = {}) {
  const [proveedores, setProveedores]       = useState([]);
  const [loadingProveedores, setLoading]    = useState(true);

  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('proveedores')
        .select('codigo, legal_name')
        .eq('activo', true)
        .order('legal_name', { ascending: true });

      if (cancelled) return;

      if (error) {
        console.error('[useProveedores] load failed:', error);
        if (onErrorRef.current) onErrorRef.current(`Cargar proveedores: ${error.message}`);
        setProveedores([]);
      } else {
        // Normalizamos a camelCase acá para no acoplar el componente a
        // la convención snake_case de la columna.
        setProveedores((data || []).map(r => ({ codigo: r.codigo, legalName: r.legal_name })));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // Solo al montar. La lista no cambia durante la sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { proveedores, loadingProveedores };
}
