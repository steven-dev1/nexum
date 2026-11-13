/** Ícono del movimiento: flecha verde que entra (ingreso) o roja que sale (salida), en una pastilla suave. */
export function DirectionIcon({ direction, className = "size-6" }: { direction: "ingreso" | "salida"; className?: string }) {
  const entering = direction === "ingreso";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full p-1 ${
        entering ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
      } ${className}`}
      role="img"
      aria-label={entering ? "Ingreso" : "Salida"}
    >
      <svg className="size-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {entering ? (
          <>
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <path d="m10 17 5-5-5-5M15 12H3" />
          </>
        ) : (
          <>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="m16 17 5-5-5-5M21 12H9" />
          </>
        )}
      </svg>
    </span>
  );
}
