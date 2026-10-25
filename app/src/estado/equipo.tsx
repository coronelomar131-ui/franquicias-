import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Empleado, Rol } from "../lib/tipos";
import type { Ruta } from "../lib/ruta";

/** Qué pestañas ve cada puesto. El dueño (sin modo equipo) ve todo. */
export const PERMISOS: Record<Rol, Ruta[]> = {
  mesero: ["salon"],
  cocina: ["cocina"],
  caja: ["salon", "cocina"],
  gerente: ["salon", "cocina", "menu"],
};
/** Sin tocar la pantalla este tiempo, la tableta pide PIN otra vez. */
const INACTIVIDAD_MS = 3 * 60 * 1000;

interface Equipo {
  modo: boolean;
  persona: Empleado | null;
  activar: () => void;
  desactivar: () => void;
  entrar: (e: Empleado) => void;
  soltar: () => void;
  puede: (r: Ruta) => boolean;
}
const Ctx = createContext<Equipo | null>(null);
export function useEquipo() {
  const e = useContext(Ctx);
  if (!e) throw new Error("useEquipo fuera del proveedor");
  return e;
}

// El modo vive en la tableta (localStorage); quién la trae puesta, solo en esta pestaña (sessionStorage)
const llaveModo = (rid: string) => "comandero:modo-equipo:" + rid;
const llavePersona = (rid: string) => "comandero:persona:" + rid;
function leer<T>(s: () => Storage, k: string): T | null { try { const v = s().getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } }
function escribir(s: () => Storage, k: string, v: unknown) { try { if (v === null) s().removeItem(k); else s().setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } }

export function ProveedorEquipo({ rid, children }: { rid: string; children: ReactNode }) {
  const [modo, setModo] = useState(() => leer<boolean>(() => localStorage, llaveModo(rid)) === true);
  const [persona, setPersona] = useState<Empleado | null>(() => leer<Empleado>(() => sessionStorage, llavePersona(rid)));
  const reloj = useRef<number>();

  useEffect(() => {
    setModo(leer<boolean>(() => localStorage, llaveModo(rid)) === true);
    setPersona(leer<Empleado>(() => sessionStorage, llavePersona(rid)));
  }, [rid]);

  const soltar = useCallback(() => { setPersona(null); escribir(() => sessionStorage, llavePersona(rid), null); }, [rid]);

  // Bloqueo por inactividad: cualquier toque reinicia la cuenta
  useEffect(() => {
    if (!modo || !persona) return;
    const reiniciar = () => { window.clearTimeout(reloj.current); reloj.current = window.setTimeout(soltar, INACTIVIDAD_MS); };
    reiniciar();
    const eventos = ["pointerdown", "keydown", "scroll"] as const;
    eventos.forEach((ev) => addEventListener(ev, reiniciar, { passive: true }));
    return () => { window.clearTimeout(reloj.current); eventos.forEach((ev) => removeEventListener(ev, reiniciar)); };
  }, [modo, persona, soltar]);

  const valor: Equipo = {
    modo, persona,
    activar: () => { setModo(true); escribir(() => localStorage, llaveModo(rid), true); soltar(); },
    desactivar: () => { setModo(false); escribir(() => localStorage, llaveModo(rid), null); soltar(); },
    entrar: (e) => { setPersona(e); escribir(() => sessionStorage, llavePersona(rid), e); },
    soltar,
    puede: (r) => !modo || (!!persona && (PERMISOS[persona.rol].includes(r) || (r === "pedido" && PERMISOS[persona.rol].includes("salon")))),
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
