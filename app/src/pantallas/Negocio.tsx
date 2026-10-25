import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useSesion } from "../estado/sesion";
import { COLORES, aplicarMarca } from "../lib/marca";
import { borrarImagen, subirImagen } from "../lib/imagen";
import { mensajeError } from "../lib/formato";
import type { ColorMarca } from "../lib/tipos";
import { useAviso } from "../componentes/Aviso";
import { Icono } from "../componentes/Icono";

export function Negocio({ rid }: { rid: string }) {
  const { actual, recargar } = useSesion();
  const avisar = useAviso();
  const [nombre, setNombre] = useState(actual?.nombre ?? "");
  const [color, setColor] = useState<ColorMarca>(actual?.color_marca ?? "achiote");
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const logo = actual?.logo_url ?? null;
  // Si se sale sin guardar, regresa al color guardado
  const guardado = useRef(actual?.color_marca);
  guardado.current = actual?.color_marca;
  useEffect(() => () => aplicarMarca(guardado.current), []);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    const { error } = await supabase.from("restaurantes").update({ nombre: nombre.trim(), color_marca: color }).eq("id", rid);
    setGuardando(false);
    if (error) { avisar(mensajeError(error), "error"); return; }
    await recargar().catch(() => {});
    avisar("Guardado");
  }
  async function cambiarLogo(f: File | undefined) {
    if (!f) return;
    setSubiendo(true);
    try {
      const url = await subirImagen(rid, "logo", f);
      const { error } = await supabase.from("restaurantes").update({ logo_url: url }).eq("id", rid);
      if (error) throw error;
      await borrarImagen(logo).catch(() => {});
      await recargar();
      avisar("Logo actualizado");
    } catch (err) { avisar(mensajeError(err), "error"); }
    finally { setSubiendo(false); if (archivo.current) archivo.current.value = ""; }
  }
  async function quitarLogo() {
    const { error } = await supabase.from("restaurantes").update({ logo_url: null }).eq("id", rid);
    if (error) { avisar(mensajeError(error), "error"); return; }
    await borrarImagen(logo).catch(() => {});
    await recargar().catch(() => {});
  }
  const elegirColor = (c: ColorMarca) => { setColor(c); aplicarMarca(c); };

  return (
    <div className="negocio">
      <div className="encabezado">
        <h1 className="titulo" tabIndex={-1}>Mi negocio</h1>
        <p className="sub">Tu nombre, tu logo y tu color aparecen en toda la app y en los tickets.</p>
      </div>

      <div className="negocio-cuerpo">
        <form className="pila" onSubmit={guardar}>
          <div className="campo"><span>Logo</span>
            <div className="logo-fila">
              <button type="button" className={"logo-caja" + (subiendo ? " subiendo" : "")} onClick={() => archivo.current?.click()} aria-label={logo ? "Cambiar logo" : "Subir logo"} disabled={subiendo}>
                {logo ? <img src={logo} alt="Logo actual" /> : <span className="logo-vacio"><Icono n="foto" tam={28} /><small>Subir</small></span>}
              </button>
              <div className="pila-corta">
                <button type="button" className="secundario" onClick={() => archivo.current?.click()} disabled={subiendo}>{subiendo ? "Subiendo…" : logo ? "Cambiar logo" : "Subir logo"}</button>
                {logo && <button type="button" className="texto peligro" onClick={quitarLogo}>Quitar logo</button>}
                <p className="nota">PNG o foto. Se ajusta solo; mejor si es cuadrado.</p>
              </div>
              <input ref={archivo} type="file" accept="image/*" hidden onChange={(e) => cambiarLogo(e.target.files?.[0])} />
            </div>
          </div>

          <label className="campo"><span>Nombre del restaurante</span>
            <input className="entrada" maxLength={80} required value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="organization" name="restaurante" />
          </label>

          <fieldset className="campo colores">
            <legend>Color de tu marca</legend>
            <div className="muestras" role="radiogroup" aria-label="Color de tu marca">
              {COLORES.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={color === c.id} className="muestra" onClick={() => elegirColor(c.id)} style={{ ["--c" as string]: c.color }}>
                  <i aria-hidden="true">{color === c.id && <Icono n="ok" tam={18} />}</i>
                  <span>{c.nombre}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <button className="primario" type="submit" disabled={guardando || !nombre.trim()}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
        </form>

        <aside className="vista-previa" aria-label="Vista previa">
          <span className="sobre">Así se ve</span>
          <div className="papel-previa">
            <div className="previa-cab">
              {logo ? <img src={logo} alt="" /> : <span className="previa-ini">{(nombre.trim() || "R").charAt(0).toUpperCase()}</span>}
              <b translate="no">{nombre.trim() || "Tu restaurante"}</b>
            </div>
            <div className="previa-linea"><span>2 × Tacos al pastor</span><span>$190</span></div>
            <div className="previa-linea"><span>1 × Agua de horchata</span><span>$45</span></div>
            <div className="previa-total"><span>Total</span><strong>$235</strong></div>
            <span className="previa-boton">Mandar a cocina</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
