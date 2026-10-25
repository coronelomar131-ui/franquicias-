import { supabase } from "./supabase";

/** Reduce la foto en el teléfono antes de subirla: así pesa poco y carga rápido en el salón. */
async function reducir(archivo: File, lado: number): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala), h = Math.round(bitmap.height * escala);
  const lienzo = document.createElement("canvas");
  lienzo.width = w; lienzo.height = h;
  lienzo.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const webp = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/webp", 0.82));
  if (webp && webp.type === "image/webp") return webp;
  const jpg = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, "image/jpeg", 0.85));
  if (!jpg) throw new Error("No se pudo procesar la imagen");
  return jpg;
}

/** Sube una imagen a la carpeta del restaurante y regresa su dirección pública. */
export async function subirImagen(rid: string, carpeta: "logo" | "productos" | "equipo", archivo: File): Promise<string> {
  if (!archivo.type.startsWith("image/")) throw new Error("Elige una imagen (foto o logo)");
  const blob = await reducir(archivo, carpeta === "productos" ? 1200 : 512);
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const ruta = `${rid}/${carpeta}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("imagenes").upload(ruta, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
  if (error) throw error;
  return supabase.storage.from("imagenes").getPublicUrl(ruta).data.publicUrl;
}

/** Borra una imagen que subimos nosotros; si la dirección no es de este proyecto no hace nada. */
export async function borrarImagen(url: string | null | undefined) {
  if (!url) return;
  const i = url.indexOf("/imagenes/");
  if (i < 0) return;
  await supabase.storage.from("imagenes").remove([url.slice(i + "/imagenes/".length)]);
}
