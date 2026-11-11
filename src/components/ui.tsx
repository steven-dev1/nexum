import type { ReactNode } from "react";

/** Estilo común de campos (input, textarea, select y disparadores de los selectores). */
export const inputCls =
  "block w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-base text-ink sm:text-[15px] placeholder:text-muted/70 transition-[border-color,box-shadow] hover:border-muted/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60";
export const labelCls = "mb-1.5 block text-[13px] font-semibold text-ink";

/**
 * Barra de desplazamiento delgada con los colores de la app (claro/oscuro).
 * `scrollbar-*` para Chrome/Edge/Firefox; `::-webkit-scrollbar` como respaldo para Safari.
 */
export const scrollCls =
  "[scrollbar-width:thin] [scrollbar-color:color-mix(in_oklab,var(--muted)_45%,transparent)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-muted/45 [&::-webkit-scrollbar-track]:bg-transparent";

const btnBase =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-[background-color,filter,box-shadow] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100";
export const btnPrimary = `${btnBase} bg-primary text-on-primary hover:bg-primary-hover`;
export const btnAccent = `${btnBase} bg-accent text-accent-ink hover:brightness-95`;
export const btnGhost = `${btnBase} border border-line bg-surface text-ink hover:bg-surface-2`;
export const btnDanger = `${btnBase} border border-danger/40 bg-danger-soft text-danger hover:brightness-95`;
export const btnSm = "!rounded-lg !px-3 !py-1.5 !text-xs";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  /** Botón principal de la página (p. ej. abrir el modal de creación). */
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1 basis-64">
        <h1 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted md:text-base">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
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
  hint,
  children,
  className = "",
}: {
  label: string;
  /** Texto de ayuda bajo el campo. */
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-5 text-muted">{hint}</span>}
    </label>
  );
}

/** Relleno del contenido dinámico de una página (el título y la estructura ya están en el shell). */
export function ContentSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="h-28 rounded-xl bg-surface-2" />
      <div className="h-44 rounded-xl bg-surface-2" />
    </div>
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
