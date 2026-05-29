import { useState, useCallback } from 'react';

// Hook minimalista para el sistema de toasts (notificaciones fugaces).
// Devuelve el estado actual y la función showToast.
export function useToast() {
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'error' }

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), type === 'error' ? 5000 : 3000);
  }, []);

  return { toast, showToast };
}
