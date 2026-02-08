import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext();

const MAX_TOASTS = 3;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.map(t =>
      t.id === id ? { ...t, exiting: true } : t
    ));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 200);
  }, []);

  const showToast = useCallback((type, message, duration = 3000) => {
    const id = ++idRef.current;
    setToasts(prev => {
      const next = [...prev, { id, type, message, exiting: false }];
      // Remove oldest if over max
      if (next.length > MAX_TOASTS) {
        return next.slice(next.length - MAX_TOASTS);
      }
      return next;
    });

    setTimeout(() => removeToast(id), duration);
    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
