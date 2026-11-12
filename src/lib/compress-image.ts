const MAX_SIDE = 1600;
const QUALITY = 0.82;

/** Reduce la foto (máx. 1600 px por lado, JPEG) para subirla rápido y ocupar poco. */
export async function compressImage(source: Blob | HTMLVideoElement, fileName = "paquete.jpg"): Promise<File> {
  let width: number;
  let height: number;
  let draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

  if (source instanceof HTMLVideoElement) {
    width = source.videoWidth;
    height = source.videoHeight;
    draw = (ctx, w, h) => ctx.drawImage(source, 0, 0, w, h);
  } else {
    const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
    width = bitmap.width;
    height = bitmap.height;
    draw = (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h);
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  draw(canvas.getContext("2d")!, canvas.width, canvas.height);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la foto"))), "image/jpeg", QUALITY),
  );
  return new File([blob], fileName, { type: "image/jpeg" });
}
