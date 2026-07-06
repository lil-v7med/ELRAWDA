import React, { useEffect } from 'react';
import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface ToastProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toasts, onClose }) => {
  return (
    <div className="fixed bottom-20 right-4 md:bottom-4 md:right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const getStyle = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-emerald-50/90 dark:bg-emerald-950/55 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300';
      case 'error':
        return 'bg-rose-50/90 dark:bg-rose-950/55 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300';
      case 'warning':
        return 'bg-amber-50/90 dark:bg-amber-950/55 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300';
      default:
        return 'bg-blue-50/90 dark:bg-blue-950/55 border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-300';
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />;
      case 'error':
        return <XCircle size={16} className="text-rose-500 shrink-0" />;
      default:
        return <AlertCircle size={16} className="text-blue-500 shrink-0" />;
    }
  };

  return (
    <div className={`flex items-center gap-3 p-3.5 rounded-xl border shadow-lg backdrop-blur-md pointer-events-auto transition-transform ${getStyle()}`}>
      {getIcon()}
      <span className="text-xs font-semibold flex-1 leading-snug">{toast.message}</span>
      <button 
        onClick={() => onClose(toast.id)}
        className="hover:opacity-70 transition-opacity p-0.5 shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default Toast;
