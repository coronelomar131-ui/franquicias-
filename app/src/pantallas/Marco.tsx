import { useEffect, useRef, type ReactNode } from "react";
import { useSesion } from "../estado/sesion";
import type { Ruta } from "../lib/ruta";
import { Icono, type NombreIcono } from "../componentes/Icono";

const PESTANAS: { id: Exclude<Ruta, "nuevo">; texto: string; icono: NombreIcono }[] = [
  { id: "salon", texto: "Salón", icono: "salon" },
  { id: "menu", texto: "Menú", icono: "menu" },
  { id: "mesas", texto: "Mesas", icono: "mesa" },
  { id: "equipo", texto: "Equipo", icono: "equipo" },
];

export function Marco({ ruta, ir, children }: { ruta: Ruta; ir: (r: Ruta) => void; children: ReactNode }) {
  const { actual, restaurantes, elegir, salir } = useSesion();
  const i = Math.max(0, PESTANAS.findIndex((p) => p.id === ruta));
  const principal = useRef<HTMLElement>(null);
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    window.scrollTo(0, 0);
    principal.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [ruta]);

  return (
    <div className="marco">
      <header className="cab">
        {restaurantes.length > 1 ? (
          <label className="cab-rest">
            <span className="sr-only">Restaurante</span>
            <select value={actual?.id} onChange={(e) => (e.target.value === "+" ? ir("nuevo") : elegir(e.target.value))} translate="no">
              {restaurantes.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              <option value="+">+ Otro restaurante</option>
            </select>
          </label>
        ) : <span className="cab-nombre" translate="no">{actual?.nombre}</span>}
        <button className="cab-salir" type="button" onClick={salir} aria-label="Cerrar sesión"><Icono n="salir" tam={20} /></button>
      </header>
      <main ref={principal} key={ruta} className="vista entra">{children}</main>
      <nav className="dock vidrio" aria-label="Secciones">
        <span className="lente" style={{ transform: `translateX(${i * 100}%)` }} aria-hidden="true" />
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" className="pestana" aria-current={p.id === ruta ? "page" : undefined} onClick={() => ir(p.id)}>
            <Icono n={p.icono} tam={20} /><span>{p.texto}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
