import { supabase } from "./supabase";
import { conRecuerdo, recordar } from "./recuerdo";
import type { Mesa } from "./tipos";

/** Con señal, deja guardado en el aparato lo necesario para tomar pedidos aunque luego se vaya el internet. */
export async function precargar(rid: string) {
  if (!navigator.onLine) return;
  await Promise.allSettled([
    conRecuerdo("categorias-activas:" + rid, () => supabase.from("categorias").select("*").eq("restaurante_id", rid).eq("activa", true).order("orden").order("creado_en")),
    conRecuerdo("productos-activos:" + rid, () => supabase.from("productos").select("*").eq("restaurante_id", rid).eq("activo", true).order("orden").order("creado_en")),
    conRecuerdo<Mesa[]>("mesas:" + rid, () => supabase.from("mesas").select("*").eq("restaurante_id", rid).eq("activa", true).order("orden").order("creado_en"))
      .then((ms) => (ms ?? []).forEach((m) => recordar("mesa:" + m.id, m))),
  ]);
}
