import { useEffect, useRef, type ReactNode } from "react";
import { useSesion } from "../estado/sesion";
import type { Ruta } from "../lib/ruta";
import { aplicarMarca, hexFondo } from "../lib/marca";
import { Icono, type NombreIcono } from "../componentes/Icono";

const PESTANAS: { id: Ruta; texto: string; icono: NombreIcono }[] = [
  { id: "salon", texto: "Salón", icono: "salon" },
  { id: "cocina", texto: "Cocina", icono: "cocina" },
  { id: "menu", texto: "Menú", icono: "menu" },
  { id: "ajustes", texto: "Ajustes", icono: "ajustes" },
];

export function Marco({ ruta, ir, children }: { ruta: Ruta; ir: (r: Ruta) => void; children: ReactNode }) {
  const { actual, restaurantes, elegir, salir } = useSesion();
  const activa = ruta === "pedido" ? "salon" : ruta;
  const i = Math.max(0, PESTANAS.findIndex((p) => p.id === activa));
  const principal = useRef<HTMLElement>(null);
  const primera = useRef(true);

  useEffect(() => { aplicarMarca(actual); }, [actual]);
  useEffect(() => {
    const cocina = ruta === "cocina";
    document.documentElement.dataset.tema = cocina ? "cocina" : "";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", cocina ? "#1f2227" : hexFondo(actual?.fondo));
    return () => { document.documentElement.dataset.tema = ""; };
  }, [ruta]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (primera.current) { primera.current = false; return; }
    window.scrollTo(0, 0);
    principal.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [ruta]);

  return (
    <div className="marco">
      <header className="cab">
        {actual?.logo_url && <img className="cab-logo" src={actual.logo_url} alt="" width={36} height={36} />}
        {restaurantes.length > 1 ? (
          <label className="cab-rest">
            <span className="sr-only">Restaurante</span>
            <select value={actual?.id} onChange={(e) => (e.target.value === "+" ? ir("nuevo") : elegir(e.target.value))} translate="no">
              {restaurantes.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              <option value="+">+ Otro restaurante</option>
            </select>
          </label>
        ) : <span className="cab-nombre" translate="no">{actual?.nombre}{actual?.eslogan && <small>{actual.eslogan}</small>}</span>}
        <button className="cab-salir" type="button" onClick={salir} aria-label="Cerrar sesión"><Icono n="salir" tam={20} /></button>
      </header>
      <main ref={principal} key={ruta} className="vista entra">{children}</main>
      <nav className="dock vidrio" aria-label="Secciones">
        <span className="lente" style={{ transform: `translateX(${i * 100}%)` }} aria-hidden="true" />
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" className="pestana" aria-current={p.id === activa ? "page" : undefined} onClick={() => ir(p.id)}>
            <Icono n={p.icono} tam={20} /><span>{p.texto}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
