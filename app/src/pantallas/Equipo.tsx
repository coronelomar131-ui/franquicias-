import { useEffect, useRef, useState, type FormEvent } from "react";
import { conTeclado } from "../lib/dispositivo";
import { supabase } from "../lib/supabase";
import type { Empleado, Rol } from "../lib/tipos";
import { mensajeError } from "../lib/formato";
import { useAviso } from "../componentes/Aviso";
import { Segmento } from "../componentes/Controles";
import { Icono } from "../componentes/Icono";
import { Cara } from "../componentes/Cara";
import { borrarImagen, subirImagen } from "../lib/imagen";

const ROLES: { id: Rol; texto: string; que: string }[] = [
  { id: "mesero", texto: "Mesero", que: "Abre mesas y toma pedidos" },
  { id: "cocina", texto: "Cocina", que: "Ve las comandas y las marca listas" },
  { id: "caja", texto: "Caja", que: "Cobra y hace el corte" },
  { id: "gerente", texto: "Gerente", que: "Todo lo anterior y autoriza cancelaciones" },
];

export function Equipo({ rid }: { rid: string }) {
  const avisar = useAviso();
  const [gente, setGente] = useState<Empleado[] | null>(null);
  const [sel, setSel] = useState<string | "nuevo" | null>(null);

  async function cargar() {
    const { data, error } = await supabase.from("empleados").select("id, restaurante_id, nombre, rol, activo, foto_url").eq("restaurante_id", rid).order("creado_en");
    if (error) throw error;
    setGente((data ?? []) as Empleado[]);
  }
  useEffect(() => { cargar().catch((e) => { setGente([]); avisar(mensajeError(e), "error"); }); }, [rid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (gente === null) return <div className="equipo"><h1 className="titulo" tabIndex={-1}>Equipo</h1><p className="sub espera">Cargando…</p></div>;
  const actual = gente.find((g) => g.id === sel);

  return (
    <div className="equipo">
      <div className="encabezado">
        <h1 className="titulo" tabIndex={-1}>Equipo</h1>
        <p className="sub">Cada persona entra en la tableta con su nombre y un PIN de 4 a 6 números. El PIN no se puede ver: si alguien lo olvida, le pones uno nuevo.</p>
      </div>
      <ul className="gafetes">
        {gente.map((g, i) => (
          <li key={g.id} style={{ ["--i" as string]: i }}>
            <button type="button" className={"gafete" + (g.activo ? "" : " apagado")} aria-pressed={sel === g.id} onClick={() => setSel(sel === g.id ? null : g.id)} aria-label={`Editar a ${g.nombre}, ${g.rol}${g.activo ? "" : ", desactivado"}`}>
              <Cara nombre={g.nombre} foto={g.foto_url} className="gafete-ini" />
              <span className="gafete-nom">{g.nombre}</span>
              <span className={"gafete-rol " + g.rol}>{ROLES.find((r) => r.id === g.rol)?.texto}</span>
              {!g.activo && <span className="sello-mini">Baja</span>}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="gafete agregar" aria-pressed={sel === "nuevo"} onClick={() => setSel(sel === "nuevo" ? null : "nuevo")}>
            <span className="gafete-ini" aria-hidden="true"><Icono n="mas" /></span>
            <span className="gafete-nom">Agregar persona</span>
          </button>
        </li>
      </ul>
      {(sel === "nuevo" || actual) && (
        <EditorEmpleado key={sel} inicial={actual} onCancelar={() => setSel(null)} onGuardar={async (v) => {
          const { data: id, error } = await supabase.rpc("guardar_empleado", { p_restaurante: rid, p_id: actual?.id ?? null, p_nombre: v.nombre, p_rol: v.rol, p_pin: v.pin || null, p_activo: v.activo });
          if (error) { avisar(mensajeError(error), "error"); return; }
          // La foto va después: para una persona nueva hace falta su id
          if (v.foto !== undefined) {
            try {
              const url = v.foto ? await subirImagen(rid, "equipo", v.foto) : null;
              const { error: e2 } = await supabase.from("empleados").update({ foto_url: url }).eq("id", id as string);
              if (e2) throw e2;
              await borrarImagen(actual?.foto_url).catch(() => {});
            } catch (e) { avisar(`${v.nombre} se guardó, pero la foto no: ${mensajeError(e)}`, "error"); }
          }
          await cargar().catch(() => {});
          avisar(actual ? `${v.nombre} guardado` : `${v.nombre} agregado al equipo`);
          setSel(null);
        }} />
      )}
    </div>
  );
}

function EditorEmpleado({ inicial, onGuardar, onCancelar }: { inicial?: Empleado; onGuardar: (v: { nombre: string; rol: Rol; pin: string; activo: boolean; foto?: File | null }) => Promise<void>; onCancelar: () => void }) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [rol, setRol] = useState<Rol>(inicial?.rol ?? "mesero");
  const [pin, setPin] = useState("");
  const [activo, setActivo] = useState(inicial?.activo ?? true);
  const [enviando, setEnviando] = useState(false);
  // undefined: no se tocó la foto; null: se quitó; File: foto nueva
  const [foto, setFoto] = useState<File | null | undefined>(undefined);
  const [vista, setVista] = useState<string | null>(inicial?.foto_url ?? null);
  const archivo = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (vista?.startsWith("blob:")) URL.revokeObjectURL(vista); }, [vista]);
  const pinOk = pin === "" ? !!inicial : /^[0-9]{4,6}$/.test(pin);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !pinOk) return;
    setEnviando(true);
    await onGuardar({ nombre: nombre.trim(), rol, pin, activo, foto });
    setEnviando(false);
  }
  return (
    <form className="editor entra" onSubmit={enviar}>
      <div className="campo"><span>Foto</span>
        <div className="foto-fila">
          <button type="button" className="foto-caja redonda" onClick={() => archivo.current?.click()} aria-label={vista ? "Cambiar foto" : "Poner foto"}>
            {vista ? <img src={vista} alt="" /> : <span className="logo-vacio"><Icono n="foto" tam={24} /><small>Foto</small></span>}
          </button>
          <div className="pila-corta">
            <button type="button" className="secundario" onClick={() => archivo.current?.click()}>{vista ? "Cambiar foto" : "Poner foto"}</button>
            {vista && <button type="button" className="texto peligro" onClick={() => { setFoto(null); setVista(null); }}>Quitar foto</button>}
            <p className="nota">Sale en su gafete y cuando entra con su PIN.</p>
          </div>
          <input ref={archivo} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFoto(f); setVista(URL.createObjectURL(f)); } e.target.value = ""; }} />
        </div>
      </div>
      <label className="campo"><span>Nombre</span>
        <input className="entrada" autoFocus={conTeclado} maxLength={60} required value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" name="nombre-empleado" placeholder="Como lo conocen en el restaurante" />
      </label>
      <div className="campo"><span>Puesto</span>
        <Segmento etiqueta="Puesto" valor={rol} onCambio={setRol} opciones={ROLES.map((r) => ({ id: r.id, texto: r.texto }))} />
        <p className="nota">{ROLES.find((r) => r.id === rol)?.que}.</p>
      </div>
      <label className="campo"><span>{inicial ? "PIN nuevo (déjalo vacío para no cambiarlo)" : "PIN"}</span>
        <input className="entrada num pin" type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoComplete="new-password" name="pin"
          value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="4 a 6 números" />
      </label>
      {pin && !pinOk && <p className="error">El PIN debe tener de 4 a 6 números.</p>}
      {inicial && (
        <label className="interruptor">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          <span className="riel" aria-hidden="true"><i /></span>
          <span>{activo ? "Activo" : "Dado de baja (ya no puede entrar)"}</span>
        </label>
      )}
      <div className="editor-acc">
        <button className="primario" type="submit" disabled={enviando || !nombre.trim() || !pinOk}>{enviando ? "Guardando…" : inicial ? "Guardar" : "Agregar"}</button>
        <button className="secundario" type="button" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  );
}
