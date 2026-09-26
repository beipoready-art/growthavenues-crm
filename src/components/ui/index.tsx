"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

// ─── Button ───────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
  secondary: "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 shadow-sm",
  ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md"; loading?: boolean }
>(function Button({ variant = "primary", size = "md", loading, className, disabled, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        buttonVariants[variant],
        className,
      )}
      {...props}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  );
});

// ─── Form controls ────────────────────────────────────────────────────────

const controlClass =
  "block w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-gray-50 disabled:text-gray-500";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={clsx(controlClass, "h-9", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return <textarea ref={ref} className={clsx(controlClass, "py-2", className)} rows={3} {...props} />;
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }
>(function Select({ className, options, placeholder, ...props }, ref) {
  return (
    <select ref={ref} className={clsx(controlClass, "h-9 pr-8", className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
});

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium text-gray-700">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p>;
}

// ─── Badge ────────────────────────────────────────────────────────────────

const badgeTones = {
  gray: "bg-gray-100 text-gray-700 ring-gray-500/10",
  blue: "bg-blue-50 text-blue-700 ring-blue-600/15",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  red: "bg-red-50 text-red-700 ring-red-600/15",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/15",
};

export function Badge({ tone = "gray", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", badgeTones[tone])}>
      {children}
    </span>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[10vh]">
      <div className="fixed inset-0 bg-gray-900/30 backdrop-blur-[1px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" className={clsx("relative w-full rounded-xl bg-white shadow-xl ring-1 ring-gray-200", width)}>
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
          </div>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-3 rounded-b-xl">{footer}</div>}
      </div>
    </div>
  );
}
