"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { getProfile } from "@/lib/auth";
import { isValidPlate, normalizePlate } from "@/lib/plate";
import { notifyUsers, staffIds } from "@/lib/push-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { VISIT_KINDS, visitWindow, windowTooLong } from "@/lib/visits";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function refresh() {
  revalidatePath("/visitas");
  revalidatePath("/accesos");
  revalidatePath("/");
}

/** El residente autoriza una visita (a pie o con vehículo) para su unidad. */
export async function createVisit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (profile.role !== "residente" || !profile.unitId) {
    return { error: "Solo los residentes con unidad autorizan visitas." };
  }

  const name = text(formData, "visitor_name");
  const kind = text(formData, "kind");
  const plate = normalizePlate(text(formData, "plate"));
  const notes = text(formData, "notes");
  if (!name || name.length > 120) return { error: "Escribe el nombre de la visita." };
  if (!VISIT_KINDS.some((k) => k.value === kind)) return { error: "Elige el tipo de visita." };
  if (plate && !isValidPlate(plate)) return { error: "La placa debe tener el formato ABC123 (carro) o ABC12D (moto)." };
  if (notes.length > 300) return { error: "La nota es demasiado larga." };

  const window = visitWindow(text(formData, "date"), text(formData, "from"), text(formData, "until"));
  if (!window) return { error: "Elige la fecha y el horario." };
  if (Date.parse(window.validUntil) <= Date.now()) return { error: "El horario ya pasó. Elige uno a futuro." };
  if (windowTooLong(window)) return { error: "Una autorización puede durar hasta 72 horas." };

  const supabase = await createClient();
  const row = {
    unit_id: profile.unitId,
    visitor_name: name,
    kind,
    plate: plate || null,
    notes: notes || null,
    valid_from: window.validFrom,
    valid_until: window.validUntil,
    status: "autorizada",
    source: "residente",
  };
  let { error } = await supabase.from("visits").insert(row);
  // El código se genera al azar: si chocara con otro (muy improbable), se reintenta una vez.
  if (error?.code === "23505") ({ error } = await supabase.from("visits").insert(row));
  if (error) return { error: "No se pudo guardar la autorización." };

  refresh();
  return { ok: "Visita autorizada. Comparte el código o el QR con tu visitante." };
}

const DECIDE_ERRORS: Record<string, string> = {
  no_existe: "La solicitud ya no existe.",
  no_permitido: "No puedes decidir sobre esta visita.",
  estado_invalido: "Esta solicitud ya fue atendida.",
  vencida: "La solicitud venció.",
};

/** El residente aprueba o rechaza una visita que portería le solicitó; portería recibe el aviso. */
export async function decideVisit(formData: FormData) {
  await getProfile();
  const id = text(formData, "id");
  const approve = text(formData, "decision") === "aprobar";
  if (!id) return;

  const supabase = await createClient();
  const { data } = await supabase.rpc("decide_visit", { p_id: id, p_approve: approve });
  const result = data as { result: string; visitor_name?: string } | null;
  refresh();
  if (!result || result.result !== "ok") return;

  const admin = createAdminClient();
  if (admin) {
    const name = result.visitor_name ?? "La visita";
    await notifyUsers(admin, await staffIds(admin), {
      title: approve ? "Visita autorizada" : "Visita rechazada",
      body: approve ? `${name}: ya puede ingresar.` : `${name}: el residente no autorizó el ingreso.`,
      url: "/accesos?tab=visitantes",
      tag: `visita-${id}`,
    });
  }
}

export async function cancelVisit(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await getProfile();
  const id = text(formData, "id");
  if (!id) return { error: "Visita inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_visit", { p_id: id });
  const result = (data as { result: string } | null)?.result;
  if (error || result !== "ok") return { error: DECIDE_ERRORS[result ?? ""] ?? "No se pudo cancelar la visita." };

  refresh();
  return { ok: "Autorización cancelada." };
}
