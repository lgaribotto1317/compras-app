import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ─── useAuth ──────────────────────────────────────────────────────
// Maneja la sesión de Supabase: estado del usuario, login, logout, y
// suscripción a cambios (otros tabs, token refresh, expiración).
//
// Estado expuesto:
//   user:    objeto del usuario logueado, o null si no hay sesión.
//   loading: true mientras hace el chequeo inicial. Importante para no
//            mostrar el LoginScreen por un parpadeo cuando ya hay sesión.
//
// Funciones:
//   signIn(email, password) → { ok, error }
//   signOut() → { ok, error }

export function useAuth() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1) Chequeo inicial: ¿hay una sesión persistida en localStorage?
    //    Esto es lo que hace que persistSession=true tenga sentido —
    //    al volver a abrir la app, recuperamos al usuario sin pedir login.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2) Suscripción a cambios. Cubre login, logout (también desde otro tab),
    //    token refresh automático, y expiración del token.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    // No hace falta setUser acá — onAuthStateChange lo dispara solo.
    return { ok: true };
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  // Nombre del usuario para autocompletar campos como "Solicitante".
  // Lee de user_metadata.full_name (lo carga el admin desde el dashboard
  // de Supabase). Si no hay nombre cargado, fallback al email — así
  // nunca queda vacío, y el usuario puede sobrescribirlo en el form.
  const userName = user?.user_metadata?.full_name || user?.email || '';

  // ── Permisos (Bloque 4) ──────────────────────────────────────────
  // Leemos del JWT (app_metadata) los claims que setea el admin desde
  // el Studio. Estos NO los puede modificar el usuario.
  //
  // isAdmin: habilita soft delete y "cancelar cualquier solicitud".
  // funcion: 'responsable_rma' | 'compras' | undefined. Si no está
  //          seteado, el user es "solicitante" (puede crear y cancelar
  //          solo las suyas en RMA solicitada).
  //
  // IMPORTANTE: estos valores son COSMÉTICOS en el frontend (mostrar
  // /ocultar botones). La seguridad real está en RLS de Supabase. Si
  // alguien hackea el DOM, Postgres rebota la acción.
  const isAdmin = user?.app_metadata?.role === 'admin';
  const funcion = user?.app_metadata?.funcion || null;

  return { user, userName, isAdmin, funcion, loading, signIn, signOut };
}
