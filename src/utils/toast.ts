type ToastType = 'success' | 'error' | 'loading' | 'blank';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

type ToastListener = (toast: Toast) => void;

class ToastManager {
  private listeners: ToastListener[] = [];

  subscribe(listener: ToastListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notify(toast: Toast) {
    this.listeners.forEach((listener) => listener(toast));
  }
}

export const toastManager = new ToastManager();

export const toast = {
  success: (message: string, options?: { duration?: number }) => {
    toastManager.notify({
      id: Math.random().toString(36).substring(2, 9),
      type: 'success',
      message,
      duration: options?.duration,
    });
  },
  error: (message: string, options?: { duration?: number }) => {
    toastManager.notify({
      id: Math.random().toString(36).substring(2, 9),
      type: 'error',
      message,
      duration: options?.duration,
    });
  },
  loading: (message: string, options?: { duration?: number }) => {
     toastManager.notify({
      id: Math.random().toString(36).substring(2, 9),
      type: 'loading',
      message,
      duration: options?.duration,
    });
  },
  dismiss: (_toastId?: string) => {
      // Implement dismissal logic if needed, for now we just rely on auto-close
      // or we can add a 'dismiss' event type
  }
};

export default toast;
