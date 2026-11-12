import type { SelectOption } from "@/components/select";
import { groupName, unitFullLabel, unitNumberLabel } from "@/lib/units";

type Unit = { id: string; tower: string; number: string };

/** Unidades agrupadas por torre para el componente <Select>. */
export function unitOptions(units: Unit[]): SelectOption[] {
  return units.map((u) => ({
    value: u.id,
    label: unitNumberLabel(u.number),
    group: groupName(u.tower),
    display: unitFullLabel(u),
  }));
}
