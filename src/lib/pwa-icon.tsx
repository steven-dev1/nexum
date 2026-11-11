import { ImageResponse } from "next/og";

/**
 * Ícono de la app (la marca de Nexum): «N» blanca con un punto amarillo sobre azul eléctrico.
 * - `maskable`: ocupa todo el lienzo y deja la marca dentro de la zona segura (80 %) para que
 *   Android pueda recortarlo en círculo o cuadrado sin cortar la «N».
 * - normal: cuadrado con esquinas redondeadas (lo usa Android/escritorio).
 * - `flat`: sin esquinas redondeadas (iOS aplica su propia máscara al ícono de pantalla de inicio).
 */
export function pwaIcon(size: number, mode: "rounded" | "maskable" | "flat" = "rounded") {
  const safe = mode === "maskable" ? 0.6 : 0.72; // proporción del lienzo que ocupa la marca
  const mark = size * safe;
  const radius = mode === "rounded" ? size * 0.22 : 0;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1d4ed8",
        borderRadius: radius,
      }}
    >
      <div style={{ position: "relative", display: "flex", width: mark, height: mark }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontSize: mark * 0.95,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          N
        </div>
        <div
          style={{
            position: "absolute",
            right: mark * 0.04,
            bottom: mark * 0.1,
            width: mark * 0.2,
            height: mark * 0.2,
            borderRadius: "50%",
            background: "#facc15",
          }}
        />
      </div>
    </div>,
    { width: size, height: size },
  );
}
