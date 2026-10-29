export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

export class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  public subscribe(listener: ToastListener): () => void {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getToasts(): ToastItem[] {
    return [...this.toasts];
  }

  public show(message: string, type: ToastType = 'info', duration: number = 4000): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const toast: ToastItem = { id, type, message, duration };
    this.toasts = [...this.toasts, toast];
    this.notify();

    if (duration > 0) {
      const timer = setTimeout(() => {
        this.dismiss(id);
      }, duration);
      this.timers.set(id, timer);
    }
    return id;
  }

  public success(message: string, duration: number = 4000): string {
    return this.show(message, 'success', duration);
  }

  public error(message: string, duration: number = 6000): string {
    return this.show(message, 'error', duration);
  }

  public info(message: string, duration: number = 4000): string {
    return this.show(message, 'info', duration);
  }

  public dismiss(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  public clear(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.toasts = [];
    this.notify();
  }

  private notify(): void {
    const current = [...this.toasts];
    this.listeners.forEach((listener) => {
      try {
        listener(current);
      } catch {
        // Ignore listener exceptions
      }
    });
  }
}

export const toastManager = new ToastManager();
export const toast = toastManager;
