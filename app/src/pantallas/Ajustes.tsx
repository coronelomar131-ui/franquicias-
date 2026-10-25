import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSesion } from "../estado/sesion";
import type { Ruta } from "../lib/ruta";
import { COLORES, TIPOGRAFIAS } from "../lib/marca";
import { Icono, type NombreIcono } from "../componentes/Icono";
import { Negocio } from "./Negocio";
import { Mesas } from "./Mesas";
import { Equipo } from "./Equipo";
import { ModoEquipo } from "./ModoEquipo";

type Parte = "negocio" | "mesas" | "equipo" | "modo";
const PARTES: { id: Parte; titulo: string; icono: NombreIcono }[] = [
  { id: "negocio", titulo: "Mi negocio", icono: "tienda" },
  { id: "mesas", titulo: "Mesas", icono: "mesa" },
  { id: "equipo", titulo: "Equipo", icono: "equipo" },
  { id: "modo", titulo: "Modo equipo", icono: "candado" },
];

export function Ajustes({ rid, parte, ir }: { rid: string; parte: string | null; ir: (r: Ruta, param?: string) => void }) {
  const p = PARTES.find((x) => x.id === parte);
  if (!p) return <Indice rid={rid} ir={ir} />;
  return (
    <div className="ajustes">
      <button type="button" className="vuelta" onClick={() => ir("ajustes")}><Icono n="atras" tam={20} />Ajustes</button>
      {p.id === "negocio" && <Negocio rid={rid} />}
      {p.id === "mesas" && <Mesas rid={rid} />}
      {p.id === "equipo" && <Equipo rid={rid} />}
      {p.id === "modo" && <ModoEquipo rid={rid} ir={ir} />}
    </div>
  );
}

/** Lista de secciones con lo que tiene cada una, para saber a dónde ir sin abrirlas. */
function Indice({ rid, ir }: { rid: string; ir: (r: Ruta, param?: string) => void }) {
  const { actual } = useSesion();
  const [cuentas, setCuentas] = useState<{ mesas: number; equipo: number } | null>(null);
  useEffect(() => {
    let vivo = true;
    Promise.all([
      supabase.from("mesas").select("id", { count: "exact", head: true }).eq("restaurante_id", rid).eq("activa", true),
      supabase.from("empleados").select("id", { count: "exact", head: true }).eq("restaurante_id", rid).eq("activo", true),
    ]).then(([m, e]) => { if (vivo) setCuentas({ mesas: m.count ?? 0, equipo: e.count ?? 0 }); }).catch(() => {});
    return () => { vivo = false; };
  }, [rid]);

  const color = COLORES.find((c) => c.id === actual?.color_marca)?.nombre ?? "Achiote";
  const letra = TIPOGRAFIAS.find((t) => t.id === actual?.tipografia)?.nombre ?? "Fonda";
  const resumen: Record<Parte, string> = {
    negocio: `${actual?.logo_url ? "Con logo" : "Sin logo"} · ${color} · Letra ${letra}`,
    mesas: cuentas ? (cuentas.mesas ? `${cuentas.mesas} ${cuentas.mesas === 1 ? "mesa" : "mesas"} en el salón` : "Todavía no hay mesas") : " ",
    equipo: cuentas ? (cuentas.equipo ? `${cuentas.equipo} ${cuentas.equipo === 1 ? "persona" : "personas"} con PIN` : "Nadie dado de alta") : " ",
    modo: "Que tus meseros entren con su PIN en esta tableta",
  };

  return (
    <div className="ajustes">
      <div className="encabezado">
        <h1 className="titulo" tabIndex={-1}>Ajustes</h1>
        <p className="sub">Todo lo de tu restaurante se cambia aquí, cuando quieras.</p>
      </div>
      <ul className="indice-aj escalon">
        {PARTES.map((x, k) => (
          <li key={x.id} style={{ ["--i" as string]: k }}>
            <button type="button" className="fila-aj" onClick={() => ir("ajustes", x.id)}>
              <span className="fila-ico"><Icono n={x.icono} tam={22} /></span>
              <span className="fila-txt"><b>{x.titulo}</b><small>{resumen[x.id]}</small></span>
              <Icono n="adelante" tam={20} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
