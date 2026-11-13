import { Modal } from "@/components/modal";

/** Miniatura de una foto (paquete, vehículo…); al pulsarla se abre en grande. */
export function PhotoThumb({
  url,
  title,
  description = "Foto tomada en portería al recibir el paquete.",
  icon = "package",
}: {
  url: string;
  title: string;
  description?: string;
  icon?: "package" | "building";
}) {
  return (
    <Modal
      title={title}
      description={description}
      icon={icon}
      size="lg"
      triggerLabel={`Ver foto: ${title}`}
      triggerClassName="group relative size-14 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-line bg-surface-2 sm:size-16"
      trigger={
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada y temporal de Supabase Storage */}
          <img
            src={url}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 text-white opacity-0 transition group-hover:bg-slate-950/35 group-hover:opacity-100">
            <svg
              className="size-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5M11 8v6M8 11h6" />
            </svg>
          </span>
        </>
      }
    >
      <div className="border-t border-line p-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada y temporal de Supabase Storage */}
        <img src={url} alt={`Foto: ${title}`} className="max-h-[70dvh] w-full rounded-xl bg-surface-2 object-contain" />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex text-sm font-semibold text-primary-ink underline-offset-2 hover:underline"
        >
          Abrir en tamaño completo
        </a>
      </div>
    </Modal>
  );
}
