import { esErrorDeRed } from "./cola";

/** Lo último que se vio de cada consulta, para abrir la app sin internet. Vive en el teléfono. */
const PREFIJO = "comandero:r:";

export function recordar(clave: string, datos: unknown) {
  try { localStorage.setItem(PREFIJO + clave, JSON.stringify(datos)); } catch { /* lleno o bloqueado: solo no se recuerda */ }
}
export function recordado<T>(clave: string): T | null {
  try { const v = localStorage.getItem(PREFIJO + clave); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}

/** Consulta al servidor y la recuerda; sin señal, regresa lo último que se vio (o siNoHay, si nunca se vio). */
export async function conRecuerdo<T>(clave: string, consulta: () => PromiseLike<{ data: T | null; error: unknown }>, siNoHay?: T): Promise<T> {
  let res: { data: T | null; error: unknown };
  try { res = await consulta(); } catch (e) { res = { data: null, error: e }; }
  if (!res.error) { recordar(clave, res.data); return res.data as T; }
  if (esErrorDeRed(res.error)) {
    const r = recordado<T>(clave);
    if (r !== null) return r;
    if (siNoHay !== undefined) return siNoHay;
  }
  throw res.error;
}
