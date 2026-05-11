"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { AlertTriangle, CheckCircle, X } from "lucide-react";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

interface ToastStore {
  toasts: Toast[];
  add: (message: string, type: "success" | "error") => void;
  remove: (id: number) => void;
}

let nextId = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type) => {
    const id = ++nextId;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message: string, type: "success" | "error" = "success") {
  useToastStore.getState().add(message, type);
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const el = document.getElementById(`toast-${t.id}`);
    if (el) {
      el.style.opacity = "0";
      el.style.transform = "translateX(100%)";
      requestAnimationFrame(() => {
        el.style.transition = "all 200ms ease-out";
        el.style.opacity = "1";
        el.style.transform = "translateX(0)";
      });
    }
  }, [t.id]);

  const isError = t.type === "error";

  return (
    <div
      id={`toast-${t.id}`}
      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
        isError
          ? "bg-red-50 border-red-200 text-red-800"
          : "bg-green-50 border-green-200 text-green-800"
      }`}
    >
      {isError ? (
        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
      ) : (
        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
      )}
      <span className="flex-1">{t.message}</span>
      <button onClick={onDismiss} className="p-0.5 rounded hover:bg-black/5 shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
