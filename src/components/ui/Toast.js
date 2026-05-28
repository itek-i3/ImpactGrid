'use client';

import { useState, useMemo, useCallback, createContext, useContext } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import styles from '@/styles/components.module.css';

const ToastContext = createContext(null);

/**
 * Toast notification system.
 * Use the useToast hook to show notifications.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, ...toast }]);

    // Auto-dismiss after duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, toast.duration || 4000);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useMemo(
    () => ({
      success: (title, message) => addToast({ type: 'success', title, message }),
      warning: (title, message) => addToast({ type: 'warning', title, message }),
      error: (title, message) => addToast({ type: 'error', title, message }),
      info: (title, message) => addToast({ type: 'info', title, message }),
    }),
    [addToast]
  );

  const icons = {
    success: <CheckCircle size={18} />,
    warning: <AlertTriangle size={18} />,
    error: <XCircle size={18} />,
    info: <Info size={18} />,
  };

  const typeClass = {
    success: styles.toastSuccess,
    warning: styles.toastWarning,
    error: styles.toastError,
    info: styles.toastInfo,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={styles.toastContainer}>
        {toasts.map((t) => (
          <div key={t.id} className={`${styles.toast} ${typeClass[t.type] || ''}`}>
            <span className={styles.toastIcon}>{icons[t.type]}</span>
            <div className={styles.toastContent}>
              <div className={styles.toastTitle}>{t.title}</div>
              {t.message && (
                <div className={styles.toastMessage}>{t.message}</div>
              )}
            </div>
            <button
              className={styles.toastClose}
              onClick={() => removeToast(t.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Return no-op if outside provider (SSR safety)
    return {
      success: () => {},
      warning: () => {},
      error: () => {},
      info: () => {},
    };
  }
  return ctx;
}
