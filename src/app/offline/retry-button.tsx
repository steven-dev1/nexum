"use client";

import { btnPrimary } from "@/components/ui";

export function RetryButton() {
  return (
    <button type="button" onClick={() => window.location.reload()} className={btnPrimary}>
      Reintentar
    </button>
  );
}
