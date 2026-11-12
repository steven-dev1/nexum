/**
 * Cómo se nombran las unidades. No asume una organización concreta: cada conjunto
 * escribe sus grupos («1», «A», «Manzana B», «Bloque Norte») y sus números
 * («101», «Casa 12», «Local 3», «A-12»).
 *
 * - Grupo corto (1–3 letras o dígitos) → «Torre X»; si ya es descriptivo, se muestra tal cual.
 * - Número que empieza por dígito → «Apto N»; si empieza por letra, tal cual («Casa 12»).
 *
 * (La misma regla vive en `public.invitation_info` en la base de datos.)
 */

type UnitLike = { tower?: string | null; number: string };

export const groupName = (tower: string | null | undefined) => {
  if (!tower) return "Sin torre";
  return /^[0-9A-Za-z]{1,3}$/.test(tower) ? `Torre ${tower}` : tower;
};

export const unitNumberLabel = (number: string) => (/^\d/.test(number) ? `Apto ${number}` : number);

export function unitFullLabel(u: UnitLike | null | undefined) {
  if (!u) return "Sin unidad";
  return u.tower ? `${groupName(u.tower)} · ${unitNumberLabel(u.number)}` : unitNumberLabel(u.number);
}

/** Orden natural: 2 antes que 10, 101 antes que 1001, A-2 antes que A-10. */
export const naturalCompare = new Intl.Collator("es", { numeric: true, sensitivity: "base" }).compare;
