import { pwaIcon } from "@/lib/pwa-icon";

// Ícono de «Añadir a pantalla de inicio» en iPhone (iOS aplica su propia máscara redondeada).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return pwaIcon(180, "flat");
}
