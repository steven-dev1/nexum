export function Brand({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary text-lg font-extrabold text-on-primary">
        N<span className="ml-px size-1.5 rounded-full bg-accent" />
      </span>
      <span className="text-xl font-extrabold tracking-tight text-ink">Nexum</span>
    </div>
  );
}
