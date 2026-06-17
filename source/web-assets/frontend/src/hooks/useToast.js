import { useState, useCallback } from 'react';

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ message, type = 'info', duration = 5000, title }) => {
    const id = toastId++;
    const newToast = { id, message, type, duration, title };
    
    setToasts((prev) => [...prev, newToast]);
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback((message, title) => {
    return addToast({ message, type: 'success', title });
  }, [addToast]);

  const error = useCallback((message, title) => {
    return addToast({ message, type: 'error', title });
  }, [addToast]);

  const info = useCallback((message, title) => {
    return addToast({ message, type: 'info', title });
  }, [addToast]);

  const game = useCallback((message, title) => {
    return addToast({ message, type: 'game', title });
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
    game
  };
}
