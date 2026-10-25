import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useSesion } from "./sesion";
import type { Empleado, Rol } from "../lib/tipos";
import type { Ruta } from "../lib/ruta";

/** Qué pestañas ve cada puesto. El dueño ve todo. */
export const PERMISOS: Record<Rol, Ruta[]> = {
  mesero: ["salon"],
  cocina: ["cocina"],
  caja: ["salon", "cocina"],
  gerente: ["salon", "cocina", "menu"],
};
/** Sin tocar la pantalla este tiempo, la sesión del equipo se cierra y vuelve a pedir PIN. */
const INACTIVIDAD_MS = 3 * 60 * 1000;

interface Equipo {
  /** true cuando quien entró es del equipo (cuenta interna con PIN), no el dueño. */
  modo: boolean;
  persona: Empleado | null;
  soltar: () => void;
  puede: (r: Ruta) => boolean;
}
const Ctx = createContext<Equipo | null>(null);
export function useEquipo() {
  const e = useContext(Ctx);
  if (!e) throw new Error("useEquipo fuera del proveedor");
  return e;
}

export function ProveedorEquipo({ children }: { children: ReactNode }) {
  const { sesion, salir } = useSesion();
  // El puesto viene en app_metadata de la sesión: lo pone el servidor y la persona no lo puede cambiar
  const meta = sesion?.user.app_metadata as { empleado_id?: string; rol?: Rol; restaurante_id?: string } | undefined;
  const empleadoId = meta?.empleado_id ?? null;
  const [persona, setPersona] = useState<Empleado | null>(null);
  const reloj = useRef<number>();
  const salirRef = useRef(salir);
  salirRef.current = salir;

  useEffect(() => {
    if (!empleadoId) { setPersona(null); return; }
    let vivo = true;
    supabase.from("empleados").select("id, restaurante_id, nombre, rol, activo, foto_url").eq("id", empleadoId).maybeSingle()
      .then(({ data }) => { if (vivo) setPersona((data as Empleado | null) ?? { id: empleadoId, restaurante_id: meta?.restaurante_id ?? "", nombre: "", rol: meta?.rol ?? "mesero", activo: true }); });
    return () => { vivo = false; };
  }, [empleadoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tableta compartida: si nadie la toca, se cierra la sesión de esa persona
  useEffect(() => {
    if (!empleadoId) return;
    const reiniciar = () => { window.clearTimeout(reloj.current); reloj.current = window.setTimeout(() => { void salirRef.current(); }, INACTIVIDAD_MS); };
    reiniciar();
    const eventos = ["pointerdown", "keydown", "scroll"] as const;
    eventos.forEach((ev) => addEventListener(ev, reiniciar, { passive: true }));
    return () => { window.clearTimeout(reloj.current); eventos.forEach((ev) => removeEventListener(ev, reiniciar)); };
  }, [empleadoId]);

  const rol = persona?.rol ?? meta?.rol ?? "mesero";
  const valor: Equipo = {
    modo: !!empleadoId,
    persona,
    soltar: () => { void salir(); },
    puede: (r) => !empleadoId || PERMISOS[rol].includes(r) || (r === "pedido" && PERMISOS[rol].includes("salon")),
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
