import { supabase, url, llave } from "./supabase";
import type { Empleado, Restaurante } from "./tipos";

/** Lo que ve el equipo antes de entrar: la marca del restaurante y quiénes trabajan ahí. */
export interface EquipoPublico {
  restaurante: Pick<Restaurante, "nombre" | "logo_url" | "eslogan" | "color_marca" | "color_principal" | "color_secundario" | "color_fondo" | "tipografia" | "fondo">;
  equipo: Pick<Empleado, "id" | "nombre" | "rol" | "foto_url">[];
}

const LLAVE_CODIGO = "comandero:codigo";
export const codigoGuardado = () => { try { return localStorage.getItem(LLAVE_CODIGO); } catch { return null; } };
export const guardarCodigo = (c: string | null) => { try { if (c) localStorage.setItem(LLAVE_CODIGO, c); else localStorage.removeItem(LLAVE_CODIGO); } catch { /* sin almacenamiento */ } };
export const limpiarCodigo = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

async function llamar<T>(cuerpo: Record<string, string>): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${url}/functions/v1/equipo`, { method: "POST", headers: { "Content-Type": "application/json", apikey: llave }, body: JSON.stringify(cuerpo) });
  } catch { throw new Error("Sin conexión. Revisa el internet."); }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error ?? "No se pudo entrar. Intenta otra vez.");
  return datos as T;
}

export const pedirEquipo = (codigo: string) => llamar<EquipoPublico>({ accion: "equipo", codigo });

/** Revisa el PIN en el servidor y abre la sesión propia de esa persona. */
export async function entrarConPin(codigo: string, empleado_id: string, pin: string) {
  const { token_hash } = await llamar<{ token_hash: string }>({ accion: "entrar", codigo, empleado_id, pin });
  const { error } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
  if (error) throw new Error("No se pudo abrir tu sesión. Intenta otra vez.");
}
