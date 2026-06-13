"use client";

import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--tg-border-subtle)] bg-[var(--tg-secondary-bg)] p-4 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-[var(--tg-hint)]">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
      {hint ? <span className="text-sm text-[var(--tg-hint)]">{hint}</span> : null}
    </Card>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const tones = {
    default: "bg-[var(--badge-default-bg)] text-[var(--badge-default-text)]",
    success: "bg-[var(--badge-success-bg)] text-[var(--badge-success-text)]",
    warning: "bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)]",
    danger: "bg-[var(--badge-danger-bg)] text-[var(--badge-danger-text)]",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  className,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const variants = {
    primary: "bg-[var(--tg-button)] text-[var(--tg-button-text)]",
    secondary: "bg-[var(--tg-muted-surface)] text-[var(--tg-text)]",
    ghost: "bg-transparent text-[var(--tg-link)]",
    danger: "bg-rose-600 text-white",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] disabled:opacity-50",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label ? <span className="text-[var(--tg-hint)]">{label}</span> : null}
      <input
        {...props}
        className={cn(
          "min-h-11 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-secondary-bg)] px-3 outline-none focus:border-[var(--tg-link)]",
          props.className
        )}
      />
    </label>
  );
}

export function Select({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label ? <span className="text-[var(--tg-hint)]">{label}</span> : null}
      <select
        {...props}
        className={cn(
          "min-h-11 rounded-xl border border-[var(--tg-border)] bg-[var(--tg-secondary-bg)] px-3 outline-none",
          props.className
        )}
      >
        {children}
      </select>
    </label>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-medium">{title}</p>
      {description ? <p className="max-w-xs text-sm text-[var(--tg-hint)]">{description}</p> : null}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--tg-link)] border-t-transparent" />
    </div>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-4">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-[var(--tg-hint)]">{subtitle}</p> : null}
    </header>
  );
}

export function LessonListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-[var(--tg-border-subtle)] bg-[var(--tg-secondary-bg)] p-4"
        >
          <div className="mb-2 h-4 w-32 rounded bg-[var(--tg-muted-surface)]" />
          <div className="mb-2 h-3 w-24 rounded bg-[var(--tg-muted-surface)]" />
          <div className="h-5 w-16 rounded-full bg-[var(--tg-muted-surface)]" />
        </div>
      ))}
    </div>
  );
}
