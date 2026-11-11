import { pwaIcon } from "@/lib/pwa-icon";

// Íconos de la PWA generados desde la marca: /pwa-icon/192, /pwa-icon/512 y /pwa-icon/maskable-512.
const ICONS = {
  "192": () => pwaIcon(192),
  "512": () => pwaIcon(512),
  "maskable-512": () => pwaIcon(512, "maskable"),
} as const;

export function generateStaticParams() {
  return Object.keys(ICONS).map((name) => ({ name }));
}

export async function GET(_request: Request, ctx: RouteContext<"/pwa-icon/[name]">) {
  const { name } = await ctx.params;
  const make = ICONS[name as keyof typeof ICONS];
  if (!make) return new Response("No encontrado", { status: 404 });
  return make();
}
