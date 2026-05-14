import { useState, useCallback } from 'react';

interface ToastState {
  message: string;
  visible: boolean;
}

export const useToast = (duration = 3000) => {
  const [toast, setToast] = useState<ToastState>({ message: '', visible: false });

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), duration);
  }, [duration]);

  return { toast, showToast };
};
