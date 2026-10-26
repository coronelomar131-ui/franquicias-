import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * Cola para trabajar sin internet. Cada cambio se intenta mandar al momento; si no hay señal,
 * se guarda en el teléfono y se manda en orden cuando vuelve. Todos los cambios están hechos
 * para poder repetirse sin duplicar: los renglones y las mesas llevan su id desde aquí, y
 * mandar a cocina o cobrar dos veces lo mismo responde "no hay nada nuevo".
 */
export type Op =
  | { tipo: "insertar"; tabla: "renglones" | "ordenes"; fila: Record<string, unknown> }
  | { tipo: "cambiar"; tabla: "renglones" | "ordenes" | "comandas"; filaId: string; cambios: Record<string, unknown> }
  | { tipo: "borrar"; tabla: "renglones"; filaId: string }
  | { tipo: "rpc"; fn: "enviar_a_cocina" | "cobrar"; args: Record<string, unknown> };
export type EnCola = Op & { clave: string; ordenId?: string; creada: string; texto: string };

const LLAVE = "comandero:cola";
const AVISO = "comandero:cola";
export const SINCRONIZADO = "comandero:sincronizado";

function leer(): EnCola[] { try { return JSON.parse(localStorage.getItem(LLAVE) ?? "[]") as EnCola[]; } catch { return []; } }
function escribir(c: EnCola[]) { try { localStorage.setItem(LLAVE, JSON.stringify(c)); } catch { /* sin almacenamiento */ } dispatchEvent(new Event(AVISO)); }
export const pendientes = (ordenId?: string) => leer().filter((o) => !ordenId || o.ordenId === ordenId);

export function esErrorDeRed(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(m);
}

// Respuestas que significan "esto ya estaba hecho": el reintento se da por bueno
const YA_HECHO = /duplicate key|23505|No hay platillos nuevos|No hay nada por cobrar|ya se cerró/i;

type Respuesta = { data?: unknown; error?: { message: string; code?: string } | null };
async function mandar(op: Op): Promise<Respuesta> {
  if (op.tipo === "insertar") return supabase.from(op.tabla).insert(op.fila);
  if (op.tipo === "cambiar") return supabase.from(op.tabla).update(op.cambios).eq("id", op.filaId);
  if (op.tipo === "borrar") return supabase.from(op.tabla).delete().eq("id", op.filaId);
  return supabase.rpc(op.fn, op.args);
}

export type Resultado = { ok: true; data?: unknown; enCola: boolean } | { ok: false; error: string };

/** Intenta guardar ya; sin señal lo deja en la cola. Con cosas pendientes, se forma detrás para respetar el orden. */
export async function guardar(op: Op, extra: { ordenId?: string; texto: string }): Promise<Resultado> {
  const formar = () => {
    escribir([...leer(), { ...op, ...extra, clave: crypto.randomUUID(), creada: new Date().toISOString() }]);
    programar();
    return { ok: true as const, enCola: true };
  };
  if (leer().length) return formar();
  try {
    const { data, error } = await mandar(op);
    if (!error || YA_HECHO.test(error.message) || error.code === "23505") return { ok: true, data, enCola: false };
    if (esErrorDeRed(error)) return formar();
    return { ok: false, error: error.message };
  } catch (e) {
    if (esErrorDeRed(e)) return formar();
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

let corriendo = false;
let reloj: number | undefined;
type Fallo = (texto: string, error: string) => void;
let alFallar: Fallo = () => {};
export const cuandoFalle = (f: Fallo) => { alFallar = f; };

function programar(ms = 6000) { window.clearTimeout(reloj); reloj = window.setTimeout(() => { void sincronizar(); }, ms); }

/** Manda lo pendiente en orden. Si se va la señal a la mitad, se detiene y reintenta después. */
export async function sincronizar() {
  if (corriendo) return;
  corriendo = true;
  try {
    for (;;) {
      const [op] = leer();
      if (!op) break;
      let error: { message: string; code?: string } | null | undefined;
      try { ({ error } = await mandar(op)); } catch (e) { error = { message: e instanceof Error ? e.message : String(e) }; }
      if (error && esErrorDeRed(error)) { programar(); return; }
      // Un error del servidor no se arregla reintentando: se avisa y se sigue con lo demás
      if (error && !YA_HECHO.test(error.message) && error.code !== "23505") alFallar(op.texto, error.message);
      escribir(leer().filter((x) => x.clave !== op.clave));
    }
    dispatchEvent(new Event(SINCRONIZADO));
  } finally { corriendo = false; }
}

if (typeof window !== "undefined") {
  addEventListener("online", () => { void sincronizar(); });
  if (leer().length) programar(1500);
}

/** Estado de la conexión y de lo pendiente, para el letrero de arriba. */
export function useConexion() {
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);
  const [cuantos, setCuantos] = useState(() => leer().length);
  useEffect(() => {
    const a = () => setEnLinea(true), b = () => setEnLinea(false), c = () => setCuantos(leer().length);
    addEventListener("online", a); addEventListener("offline", b); addEventListener(AVISO, c);
    return () => { removeEventListener("online", a); removeEventListener("offline", b); removeEventListener(AVISO, c); };
  }, []);
  return { enLinea, cuantos };
}

// ── Lo pendiente encima de lo último que se vio ──────────────────────────
// Sin señal, la pantalla muestra lo recordado más lo que está en la cola, como si ya hubiera llegado.
type Fila = { id: string };
const campo = (x: Fila, k: string) => (x as unknown as Record<string, unknown>)[k];

export function conPendientesOrdenes<T extends Fila>(lista: T[]): T[] {
  let r = [...lista];
  for (const op of leer()) {
    if (op.tipo === "insertar" && op.tabla === "ordenes" && !r.some((o) => o.id === op.fila.id)) {
      r.push({ folio: 0, estado: "abierta", abierta_en: op.creada, ...op.fila } as unknown as T);
    } else if (op.tipo === "cambiar" && op.tabla === "ordenes") {
      r = r.map((o) => (o.id === op.filaId ? { ...o, ...op.cambios } : o));
    } else if (op.tipo === "rpc" && op.fn === "cobrar" && op.args.p_comensales == null) {
      r = r.map((o) => (o.id === op.args.p_orden ? { ...o, estado: "pagada" } : o));
    }
  }
  return r;
}

export function conPendientesRenglones<T extends Fila>(ordenId: string, lista: T[]): T[] {
  let r = [...lista];
  for (const op of pendientes(ordenId)) {
    if (op.tipo === "insertar" && op.tabla === "renglones" && !r.some((x) => x.id === op.fila.id)) {
      r.push({ nota: "", comanda_id: null, pagado: false, cancelado: false, creado_en: op.creada, ...op.fila } as unknown as T);
    } else if (op.tipo === "cambiar" && op.tabla === "renglones") {
      r = r.map((x) => (x.id === op.filaId ? { ...x, ...op.cambios } : x));
    } else if (op.tipo === "borrar") {
      r = r.filter((x) => x.id !== op.filaId);
    } else if (op.tipo === "rpc" && op.fn === "enviar_a_cocina") {
      r = r.map((x) => (campo(x, "comanda_id") ? x : { ...x, comanda_id: "cola" }));
    } else if (op.tipo === "rpc" && op.fn === "cobrar") {
      const quienes = op.args.p_comensales as number[] | null;
      r = r.map((x) => (!quienes || quienes.includes(campo(x, "comensal") as number) ? { ...x, pagado: true } : x));
    }
  }
  return r;
}
