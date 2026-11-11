import { PageSkeleton } from "@/components/ui";

// Frontera de Suspense por debajo del layout (app): es la que cubre las
// navegaciones del lado del cliente entre /paqueteria, /reservas, etc.
export default function Loading() {
  return <PageSkeleton />;
}
