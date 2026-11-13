import { getProfile, isAdmin, isStaff } from "@/lib/auth";
import { findDataset } from "@/lib/export/datasets";
import { buildPdf, buildXlsx, fileName } from "@/lib/export/files";
import { resolveRange } from "@/lib/export/range";
import { createClient } from "@/lib/supabase/server";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const fail = (message: string, status: number) =>
  Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Exporta un conjunto de datos a Excel o PDF: `GET /api/export/<dataset>?format=xlsx|pdf&desde=AAAA-MM-DD&hasta=AAAA-MM-DD`.
 * Usa el cliente del usuario (la RLS sigue aplicando), valida el rol de cada conjunto y limita el rango y las filas.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/export/[dataset]">) {
  const { dataset: key } = await ctx.params;
  const dataset = findDataset(key);
  if (!dataset) return fail("Ese reporte no existe.", 404);

  const profile = await getProfile();
  const allowed = dataset.access === "admin" ? isAdmin(profile) : isStaff(profile);
  if (!allowed) return fail("No tienes permiso para exportar este reporte.", 403);

  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
  const resolved = resolveRange(url.searchParams.get("desde"), url.searchParams.get("hasta"));
  if ("error" in resolved) return fail(resolved.error, 400);
  const { range } = resolved;

  const supabase = await createClient();
  const rows = await dataset.load(supabase, range);

  const subtitle = dataset.ranged ? `Del ${range.from} al ${range.to}` : "Estado actual";
  const name = fileName(["nexum", dataset.key, ...(dataset.ranged ? [range.from, range.to] : [])], format);
  const body =
    format === "pdf"
      ? buildPdf(dataset.label, subtitle, dataset.columns, rows)
      : await buildXlsx(dataset.label, subtitle, dataset.columns, rows);

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : XLSX,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
