import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSesion } from "../estado/sesion";
import { useEquipo } from "../estado/equipo";
import { supabase } from "../lib/supabase";
import type { Lugar, Ruta } from "../lib/ruta";
import { aplicarMarca, hexFondo } from "../lib/marca";
import { Icono, type NombreIcono } from "../componentes/Icono";
import { Cara } from "../componentes/Cara";

const PESTANAS: { id: Ruta; texto: string; icono: NombreIcono }[] = [
  { id: "salon", texto: "Salón", icono: "salon" },
  { id: "cocina", texto: "Cocina", icono: "cocina" },
  { id: "menu", texto: "Menú", icono: "menu" },
  { id: "ajustes", texto: "Ajustes", icono: "ajustes" },
];

/** Pestaña a la que pertenece cada lugar y qué tan adentro está. */
const pestanaDe = (l: Lugar) => (l.ruta === "pedido" ? "salon" : l.ruta);
const fondoDe = (l: Lugar) => (l.ruta === "pedido" || (l.ruta === "ajustes" && l.param) ? 1 : 0);
type Dir = "adelante" | "atras" | "derecha" | "izquierda";

/** Cuántas comandas esperan en cocina, en vivo, para el globo de la pestaña. */
function usePendientes(rid: string | undefined) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!rid) return;
    let vivo = true;
    const contar = async () => {
      const { count } = await supabase.from("comandas").select("id", { count: "exact", head: true }).eq("restaurante_id", rid).eq("estado", "pendiente");
      if (vivo) setN(count ?? 0);
    };
    contar().catch(() => {});
    const canal = supabase.channel("globo-" + rid)
      .on("postgres_changes", { event: "*", schema: "public", table: "comandas", filter: "restaurante_id=eq." + rid }, () => { contar().catch(() => {}); })
      .subscribe();
    return () => { vivo = false; supabase.removeChannel(canal); };
  }, [rid]);
  return n;
}

export function Marco({ lugar, ir, children }: { lugar: Lugar; ir: (r: Ruta, param?: string) => void; children: ReactNode }) {
  const { actual, restaurantes, elegir, salir } = useSesion();
  const { modo, persona, soltar, puede } = useEquipo();
  const pestanas = PESTANAS.filter((p) => puede(p.id));
  const { ruta } = lugar;
  const activa = pestanaDe(lugar);
  const i = Math.max(0, pestanas.findIndex((p) => p.id === activa));
  const principal = useRef<HTMLElement>(null);
  const previo = useRef<Lugar | null>(null);
  const pendientes = usePendientes(actual?.id);
  const llave = ruta + "/" + (lugar.param ?? "");

  // Dirección de entrada: entrar a algo viene de la derecha, regresar de la izquierda,
  // cambiar de pestaña se desliza hacia el lado de la pestaña.
  const dir = useRef<Dir | undefined>(undefined);
  if (previo.current && previo.current.ruta + "/" + (previo.current.param ?? "") !== llave) {
    const a = previo.current;
    const fa = fondoDe(a), fb = fondoDe(lugar);
    const ia = pestanas.findIndex((p) => p.id === pestanaDe(a));
    dir.current = fb > fa ? "adelante" : fb < fa && pestanaDe(a) === activa ? "atras" : i >= ia ? "derecha" : "izquierda";
  }
  previo.current = lugar;

  useEffect(() => { aplicarMarca(actual); }, [actual]);
  useEffect(() => {
    const cocina = ruta === "cocina";
    document.documentElement.dataset.tema = cocina ? "cocina" : "";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", cocina ? "#1f2227" : hexFondo(actual?.fondo, actual?.color_fondo));
    return () => { document.documentElement.dataset.tema = ""; };
  }, [ruta]); // eslint-disable-line react-hooks/exhaustive-deps
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    window.scrollTo(0, 0);
    principal.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [llave]);

  return (
    <div className="marco">
      <header className="cab">
        {actual?.logo_url && <img className="cab-logo" src={actual.logo_url} alt="" width={36} height={36} />}
        {modo ? <span className="cab-nombre" translate="no">{actual?.nombre}</span> : restaurantes.length > 1 ? (
          <label className="cab-rest">
            <span className="sr-only">Restaurante</span>
            <select value={actual?.id} onChange={(e) => (e.target.value === "+" ? ir("nuevo") : elegir(e.target.value))} translate="no">
              {restaurantes.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              <option value="+">+ Otro restaurante</option>
            </select>
          </label>
        ) : <span className="cab-nombre" translate="no">{actual?.nombre}{actual?.eslogan && <small>{actual.eslogan}</small>}</span>}
        {modo && persona ? (
          <button className="cab-persona" type="button" onClick={soltar} aria-label={`${persona.nombre}. Cambiar de persona`}>
            <Cara nombre={persona.nombre} foto={persona.foto_url} />
            <span className="cab-persona-txt"><b>{persona.nombre.trim().split(/\s+/)[0]}</b><small>Cambiar</small></span>
          </button>
        ) : <button className="cab-salir" type="button" onClick={salir} aria-label="Cerrar sesión"><Icono n="salir" tam={20} /></button>}
      </header>
      <main ref={principal} key={llave} className="vista" data-dir={dir.current}>{children}</main>
      {pestanas.length > 1 && <nav className="dock vidrio" aria-label="Secciones" style={{ ["--n" as string]: pestanas.length }}>
        <span className="lente" style={{ transform: `translateX(${i * 100}%)` }} aria-hidden="true" />
        {pestanas.map((p) => (
          <button key={p.id} type="button" className="pestana" aria-current={p.id === activa ? "page" : undefined}
            onClick={() => (p.id === activa && fondoDe(lugar) === 0 ? window.scrollTo({ top: 0, behavior: "smooth" }) : ir(p.id))}
            aria-label={p.id === "cocina" && pendientes ? `Cocina, ${pendientes} ${pendientes === 1 ? "comanda pendiente" : "comandas pendientes"}` : undefined}>
            <span className="pestana-ico">
              <Icono n={p.icono} tam={20} />
              {p.id === "cocina" && pendientes > 0 && <b key={pendientes} className="globo" aria-hidden="true">{pendientes > 99 ? "99+" : pendientes}</b>}
            </span>
            <span>{p.texto}</span>
          </button>
        ))}
      </nav>}
    </div>
  );
}
