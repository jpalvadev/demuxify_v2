import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { toastManager, ToastItem, ToastType } from "../lib/toast";
import { cn } from "../lib/utils";

export function useToasts(): ToastItem[] {
  const [toasts, setToasts] = useState<ToastItem[]>(() =>
    toastManager.getToasts()
  );

  useEffect(() => {
    const unsubscribe = toastManager.subscribe((updated) => {
      setToasts(updated);
    });
    return unsubscribe;
  }, []);

  return toasts;
}

const TOAST_ICONS: Record<
  ToastType,
  React.ComponentType<{ className?: string }>
> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
};

const TOAST_STYLES: Record<
  ToastType,
  {
    border: string;
    iconColor: string;
    badgeBg: string;
    role: "status" | "alert";
    ariaLive: "polite" | "assertive";
  }
> = {
  success: {
    border:
      "border-emerald-500/40 bg-card/95 text-foreground shadow-emerald-500/10",
    iconColor: "text-emerald-400",
    badgeBg: "bg-emerald-500/10 text-emerald-400",
    role: "status",
    ariaLive: "polite",
  },
  error: {
    border:
      "border-destructive/50 bg-card/95 text-foreground shadow-destructive/10",
    iconColor: "text-destructive",
    badgeBg: "bg-destructive/10 text-destructive",
    role: "alert",
    ariaLive: "assertive",
  },
  info: {
    border: "border-primary/40 bg-card/95 text-foreground shadow-primary/10",
    iconColor: "text-primary",
    badgeBg: "bg-primary/10 text-primary",
    role: "status",
    ariaLive: "polite",
  },
};

export interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const style = TOAST_STYLES[toast.type];
  const Icon = TOAST_ICONS[toast.type];

  return (
    <div
      role={style.role}
      aria-live={style.ariaLive}
      data-testid={`toast-${toast.type}`}
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl backdrop-blur-md transition-all animate-in slide-in-from-bottom-3 duration-200",
        style.border
      )}
    >
      <div className={cn("p-1 rounded-lg shrink-0 mt-0.5", style.badgeBg)}>
        <Icon className={cn("h-4 w-4", style.iconColor)} />
      </div>

      <div className="flex-1 text-xs font-medium leading-relaxed break-words">
        {toast.message}
      </div>

      <button
        type="button"
        aria-label="Dismiss Notification"
        onClick={() => onDismiss(toast.id)}
        className="text-muted-foreground hover:text-foreground shrink-0 rounded-md p-1 transition-colors -mr-1 -mt-1"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC<{ className?: string }> = ({
  className,
}) => {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div
      data-testid="toast-stack"
      aria-label="Notifications"
      className={cn(
        "flex flex-col gap-2.5 w-full max-w-md pointer-events-none px-4 sm:px-0 mt-4",
        className
      )}
    >
      {toasts.map((item) => (
        <Toast
          key={item.id}
          toast={item}
          onDismiss={(id) => toastManager.dismiss(id)}
        />
      ))}
    </div>
  );
};
