import type { SelectOption } from "@/components/select";

type Unit = { id: string; tower: string; number: string };

/** Unidades agrupadas por torre para el componente <Select>. */
export function unitOptions(units: Unit[]): SelectOption[] {
  return units.map((u) => ({
    value: u.id,
    label: `Apto ${u.number}`,
    group: u.tower ? `Torre ${u.tower}` : "Sin torre",
    display: u.tower ? `Torre ${u.tower} · Apto ${u.number}` : `Apto ${u.number}`,
  }));
}
