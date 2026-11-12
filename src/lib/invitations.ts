import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";

/** Token aleatorio de 192 bits (32 caracteres, seguro para URL). */
export const newToken = () => randomBytes(24).toString("base64url");

/** Hash que se guarda en la base de datos; coincide con `sha256` de `redeem_invitation`. */
export const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

/** Dirección pública de la app, tomada de la petición (sirve en local y en Vercel). */
export async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
