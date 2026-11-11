import type { ReactNode } from "react";

export const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary";
export const labelCls = "mb-1 block text-sm font-medium text-ink";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
export const btnPrimary = `${btnBase} bg-primary text-on-primary hover:bg-primary-hover`;
export const btnAccent = `${btnBase} bg-accent text-accent-ink hover:brightness-95`;
export const btnGhost = `${btnBase} border border-line bg-surface text-ink hover:bg-surface-2`;
export const btnSm = "!px-3 !py-1.5 !text-xs";

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted md:text-base">{description}</p>}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-4 md:p-5 ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-base font-semibold text-ink">{children}</h2>;
}

const tones = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary-soft text-primary-ink",
  accent: "bg-accent-soft text-ink",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
} as const;

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
      {children}
    </p>
  );
}

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="h-8 w-56 rounded-lg bg-surface-2" />
      <div className="h-24 rounded-xl bg-surface-2" />
      <div className="h-40 rounded-xl bg-surface-2" />
    </div>
  );
}
