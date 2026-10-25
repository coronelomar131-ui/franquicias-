import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Restaurante } from "../lib/tipos";

interface Sesion {
  sesion: Session | null;
  cargando: boolean;
  restaurantes: Restaurante[];
  actual: Restaurante | null;
  elegir: (id: string) => void;
  recargar: () => Promise<void>;
  salir: () => Promise<void>;
}
const Ctx = createContext<Sesion | null>(null);
export function useSesion() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSesion fuera del proveedor");
  return s;
}

const LLAVE = "comandero:restaurante";
function leer() { try { return localStorage.getItem(LLAVE); } catch { return null; } }
function guardar(id: string | null) { try { if (id) localStorage.setItem(LLAVE, id); else localStorage.removeItem(LLAVE); } catch { /* sin almacenamiento */ } }

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [cargando, setCargando] = useState(true);
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [actualId, setActualId] = useState<string | null>(leer());

  const recargar = useCallback(async () => {
    const { data, error } = await supabase.from("restaurantes").select("id, nombre, zona_horaria, logo_url, color_marca, tipografia, fondo, eslogan").order("creado_en");
    if (error) throw error;
    setRestaurantes(data ?? []);
    setActualId((id) => (data?.some((r) => r.id === id) ? id : data?.[0]?.id ?? null));
  }, []);

  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => { if (vivo) { setSesion(data.session); if (!data.session) setCargando(false); } });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSesion(s); if (!s) { setRestaurantes([]); setCargando(false); } });
    return () => { vivo = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!sesion) return;
    setCargando(true);
    recargar().catch(() => setRestaurantes([])).finally(() => setCargando(false));
  }, [sesion?.user.id, recargar]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { guardar(actualId); }, [actualId]);

  const valor: Sesion = {
    sesion, cargando, restaurantes,
    actual: restaurantes.find((r) => r.id === actualId) ?? null,
    elegir: setActualId,
    recargar,
    salir: async () => { await supabase.auth.signOut(); guardar(null); setActualId(null); },
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
