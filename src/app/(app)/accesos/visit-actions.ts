"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { getProfile, isStaff, unitLabel } from "@/lib/auth";
import { isValidPlate, normalizePlate } from "@/lib/plate";
import { pushInBackground, residentsOfUnit, sendPush } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { VISIT_KINDS, kindLabel, parseVisitCode } from "@/lib/visits";

const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function unitName(supabase: Supabase, unitId: string | undefined) {
  if (!unitId) return "";
  const { data } = await supabase.from("units").select("tower, number").eq("id", unitId).maybeSingle();
  return data ? unitLabel(data) : "";
}

/** Portería registra a quien llega sin aviso: pide autorización al residente o deja pasar directamente. */
export async function registerWalkin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getProfile();
  if (!isStaff(profile)) return { error: "Solo portería y administración registran visitantes." };

  const unitId = text(formData, "unit_id");
  const name = text(formData, "visitor_name");
  const document = text(formData, "document");
  const kind = text(formData, "kind");
  const plate = normalizePlate(text(formData, "plate"));
  const notes = text(formData, "notes");
  const direct = text(formData, "intent") === "directo";

  if (!unitId) return { error: "Elige la unidad que visita." };
  if (!name || name.length > 120) return { error: "Escribe el nombre del visitante." };
  if (document.length > 30) return { error: "El documento es demasiado largo." };
  if (!VISIT_KINDS.some((k) => k.value === kind)) return { error: "Elige el tipo de visita." };
  if (plate && !isValidPlate(plate)) return { error: "La placa debe tener el formato ABC123 (carro) o ABC12D (moto)." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_walkin", {
    p_unit: unitId,
    p_name: name,
    p_document: document,
    p_kind: kind,
    p_plate: plate,
    p_notes: notes,
    p_direct: direct,
  });
  const result = data as { result: string; id?: string } | null;
  if (error || result?.result !== "ok") return { error: "No se pudo registrar al visitante." };

  pushInBackground(async () =>
    sendPush(supabase, await residentsOfUnit(supabase, unitId), {
      title: direct ? "Ingresó una visita" : "Alguien pregunta por ti en portería",
      body: direct
        ? `${name} ingresó a tu unidad.`
        : `${name} (${kindLabel(kind)}${plate ? ` · ${plate}` : ""}) pide ingresar. ¿Lo autorizas?`,
      url: "/visitas",
      tag: `visita-${result.id}`,
    }),
  );

  revalidatePath("/accesos");
  revalidatePath("/visitas");
  return {
    ok: direct ? "Ingreso registrado." : "Solicitud enviada al residente. Te avisaremos cuando responda.",
  };
}

export type VisitCheck = {
  result: "ok" | "error";
  /** Texto para mostrar en pantalla. */
  message: string;
  tone: "success" | "danger" | "warning";
  visit?: { id: string; name: string; unit: string; plate: string | null; kind: string };
};

const CHECK_MESSAGES: Record<string, string> = {
  no_existe: "Ese código no existe. Revisa que esté completo.",
  no_permitido: "No tienes permiso para registrar ingresos.",
  ya_dentro: "Esta visita ya figura dentro del conjunto.",
  sin_autorizar: "Esta visita todavía no está autorizada: el residente no ha respondido.",
  vencida: "La autorización venció.",
  aun_no: "La autorización todavía no empieza.",
  estado_invalido: "Esta autorización ya no está vigente (cancelada, rechazada o ya salió).",
};

/** Registra el ingreso de una visita con el código (QR o teclado). */
export async function checkInVisit(raw: string): Promise<VisitCheck> {
  const profile = await getProfile();
  if (!isStaff(profile)) return { result: "error", tone: "danger", message: CHECK_MESSAGES.no_permitido };

  const code = parseVisitCode(String(raw ?? ""));
  if (!code) return { result: "error", tone: "danger", message: "Ese no parece un código de visita (6 caracteres)." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_in_visit", { p_ref: code });
  const r = data as {
    result: string;
    id?: string;
    visitor_name?: string;
    unit_id?: string;
    plate?: string | null;
    kind?: string;
  } | null;
  if (error || !r) return { result: "error", tone: "danger", message: "No se pudo validar el código. Intenta de nuevo." };

  const unit = await unitName(supabase, r.unit_id);
  const visit =
    r.id && r.visitor_name
      ? { id: r.id, name: r.visitor_name, unit, plate: r.plate ?? null, kind: r.kind ?? "visita" }
      : undefined;

  if (r.result !== "ok") {
    const detail = r.visitor_name ? ` (${r.visitor_name}${unit ? ` · ${unit}` : ""})` : "";
    return {
      result: "error",
      tone: r.result === "ya_dentro" || r.result === "sin_autorizar" ? "warning" : "danger",
      message: `${CHECK_MESSAGES[r.result] ?? "No se pudo registrar el ingreso."}${detail}`,
      visit,
    };
  }

  const unitId = r.unit_id;
  if (unitId) {
    pushInBackground(async () =>
      sendPush(supabase, await residentsOfUnit(supabase, unitId), {
        title: "Ingresó tu visita",
        body: `${r.visitor_name} ingresó al conjunto.`,
        url: "/visitas",
        tag: `visita-${r.id}`,
      }),
    );
  }
  revalidatePath("/accesos");
  revalidatePath("/visitas");
  return { result: "ok", tone: "success", message: `Ingreso autorizado · ${unit}`, visit };
}

/** Registra la salida de una visita que está dentro. */
export async function checkOutVisit(id: string): Promise<{ ok: boolean; message: string }> {
  const profile = await getProfile();
  if (!isStaff(profile) || !id) return { ok: false, message: "No tienes permiso para registrar salidas." };

  const supabase = await createClient();
  const { data } = await supabase.rpc("check_out_visit", { p_id: id });
  const r = data as { result: string } | null;
  revalidatePath("/accesos");
  revalidatePath("/visitas");
  return r?.result === "ok"
    ? { ok: true, message: "Salida registrada." }
    : { ok: false, message: "Esa visita ya no figura dentro." };
}

export async function checkOutVisitForm(formData: FormData) {
  await checkOutVisit(String(formData.get("id") ?? ""));
}
