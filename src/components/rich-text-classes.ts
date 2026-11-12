/** Estilos del texto enriquecido, compartidos por el editor y la vista de lectura. */
export const richCls = [
  "text-sm leading-6 text-ink",
  "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
  "[&_h2]:mb-1.5 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:leading-snug",
  "[&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold",
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
  "[&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:text-muted",
  "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:break-words",
  "[&_hr]:my-4 [&_hr]:border-line",
  "[&_img]:my-3 [&_img]:max-h-[28rem] [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-line",
  "[&_strong]:font-semibold",
].join(" ");
