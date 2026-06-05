import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 1800);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgStyles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />,
    info: <Info className="w-5 h-5 text-indigo-600 shrink-0" />,
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-9999 animate-fade-in">
      <div className={`p-4 rounded-xl border-2 shadow-lg flex items-start space-x-3 space-x-reverse ${bgStyles[type]}`}>
        {icons[type]}
        <div className="flex-1 text-xs font-bold leading-relaxed">
          {message}
        </div>
        <button 
          onClick={onClose} 
          className="text-slate-400 hover:text-slate-600 font-extrabold text-sm px-1.5 focus:outline-none cursor-pointer"
        >
          ×
        </button>
      </div>
    </div>
  );
}
