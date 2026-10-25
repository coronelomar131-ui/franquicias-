import { useEffect, useState, type FormEvent } from "react";
import { codigoGuardado, entrarConPin, guardarCodigo, limpiarCodigo, pedirEquipo, type EquipoPublico } from "../lib/acceso";
import { aplicarMarca } from "../lib/marca";
import { Cara } from "../componentes/Cara";
import { TecladoPin } from "../componentes/TecladoPin";

const PUESTO = { mesero: "Mesero", cocina: "Cocina", caja: "Caja", gerente: "Gerente" } as const;

/** Entrada del equipo: código del restaurante (una vez por teléfono), luego nombre y PIN. */
export function AccesoEquipo() {
  const [codigo, setCodigo] = useState(() => codigoGuardado() ?? "");
  const [datos, setDatos] = useState<EquipoPublico | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [quien, setQuien] = useState<EquipoPublico["equipo"][number] | null>(null);

  async function buscar(c: string) {
    setCargando(true); setError("");
    try {
      const d = await pedirEquipo(c);
      setDatos(d); guardarCodigo(c);
      // La pantalla toma la marca del restaurante: el equipo reconoce su lugar
      aplicarMarca(d.restaurante);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setDatos(null); }
    finally { setCargando(false); }
  }
  // Si este teléfono ya conoce el código, va directo a los nombres
  useEffect(() => { const c = codigoGuardado(); if (c) void buscar(c); }, []);

  function otro() { guardarCodigo(null); setDatos(null); setQuien(null); setCodigo(""); aplicarMarca(null); }

  if (quien && datos) {
    return (
      <TecladoPin key={quien.id} nombre={quien.nombre} foto={quien.foto_url} onVolver={() => setQuien(null)}
        onProbar={async (pin) => {
          try { await entrarConPin(codigo, quien.id, pin); return null; }
          catch (e) { return e instanceof Error ? e.message : String(e); }
        }} />
    );
  }

  if (datos) {
    const r = datos.restaurante;
    return (
      <div className="acceso-equipo entra">
        <div className="acceso-rest">
          {r.logo_url ? <img src={r.logo_url} alt="" width={56} height={56} /> : <span className="bloqueo-ini" aria-hidden="true">{r.nombre.charAt(0).toUpperCase()}</span>}
          <div><b translate="no">{r.nombre}</b>{r.eslogan && <small>{r.eslogan}</small>}</div>
        </div>
        <h2 className="acceso-t">¿Quién entra?</h2>
        {datos.equipo.length === 0 ? <p className="sub">Todavía no hay nadie dado de alta. El dueño los agrega en Ajustes → Equipo.</p> : (
          <ul className="caras escalon">
            {datos.equipo.map((g, i) => (
              <li key={g.id} style={{ ["--i" as string]: i }}>
                <button type="button" className="cara" onClick={() => setQuien(g)}>
                  <Cara nombre={g.nombre} foto={g.foto_url} />
                  <b>{g.nombre}</b>
                  <small>{PUESTO[g.rol]}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="texto" onClick={otro}>Es otro restaurante</button>
      </div>
    );
  }

  const enviar = (e: FormEvent) => { e.preventDefault(); if (codigo.length === 6) void buscar(codigo); };
  return (
    <form className="pila entra" onSubmit={enviar} noValidate>
      <label className="campo"><span>Código del restaurante</span>
        <input className="entrada codigo" value={codigo} onChange={(e) => setCodigo(limpiarCodigo(e.target.value))} inputMode="text" autoCapitalize="characters"
          autoComplete="off" spellCheck={false} maxLength={6} placeholder="ABC234" aria-describedby="codigo-ayuda" />
      </label>
      <p className="nota" id="codigo-ayuda">Son 6 letras y números. Te lo da el dueño; solo lo pones la primera vez en este teléfono.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primario ancho" type="submit" disabled={codigo.length !== 6 || cargando}>{cargando ? "Buscando…" : "Continuar"}</button>
    </form>
  );
}
