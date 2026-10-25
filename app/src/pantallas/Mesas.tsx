import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import type { Forma, Mesa } from "../lib/tipos";
import { mensajeError } from "../lib/formato";
import { useAviso } from "../componentes/Aviso";
import { MesaDibujo } from "../componentes/MesaDibujo";
import { DobleToque, Paso, Segmento } from "../componentes/Controles";
import { Icono } from "../componentes/Icono";

const FORMAS: { id: Forma; texto: string }[] = [{ id: "cuadrada", texto: "Cuadrada" }, { id: "redonda", texto: "Redonda" }, { id: "larga", texto: "Larga" }];

export function Mesas({ rid }: { rid: string }) {
  const avisar = useAviso();
  const [mesas, setMesas] = useState<Mesa[] | null>(null);
  const [sel, setSel] = useState<string | "nueva" | null>(null);

  async function cargar() {
    const { data, error } = await supabase.from("mesas").select("*").eq("restaurante_id", rid).order("orden").order("creado_en");
    if (error) throw error;
    setMesas(data ?? []);
  }
  useEffect(() => { cargar().catch((e) => { setMesas([]); avisar(mensajeError(e), "error"); }); }, [rid]); // eslint-disable-line react-hooks/exhaustive-deps

  async function hacer(fn: () => PromiseLike<{ error: unknown }>, ok?: string) {
    const { error } = await fn();
    if (error) { avisar(mensajeError(error), "error"); return false; }
    await cargar().catch(() => {});
    if (ok) avisar(ok);
    return true;
  }
  async function mover(id: string, dir: -1 | 1) {
    if (!mesas) return;
    const i = mesas.findIndex((m) => m.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= mesas.length) return;
    const nueva = [...mesas]; [nueva[i], nueva[j]] = [nueva[j], nueva[i]];
    for (const [k, m] of nueva.entries()) {
      if (m.orden === k) continue;
      const { error } = await supabase.from("mesas").update({ orden: k }).eq("id", m.id);
      if (error) { avisar(mensajeError(error), "error"); break; }
    }
    await cargar().catch(() => {});
  }

  if (mesas === null) return <div className="mesas-ed"><h1 className="titulo" tabIndex={-1}>Mesas</h1><p className="sub espera">Cargando…</p></div>;
  const lugares = mesas.filter((m) => m.activa).reduce((s, m) => s + m.lugares, 0);
  const actual = mesas.find((m) => m.id === sel);
  const siguiente = String(mesas.reduce((n, m) => Math.max(n, Number(m.nombre) || 0), 0) + 1);

  return (
    <div className="mesas-ed">
      <div className="encabezado">
        <h1 className="titulo" tabIndex={-1}>Mesas</h1>
        <p className="sub"><b>{mesas.filter((m) => m.activa).length}</b> mesas · <b>{lugares}</b> lugares en total</p>
      </div>
      <div className="rejilla-mesas">
        {mesas.map((m, i) => (
          <button key={m.id} type="button" className={"mesa-ficha " + m.forma + (m.activa ? "" : " apagada")} aria-pressed={sel === m.id} style={{ ["--i" as string]: i }}
            onClick={() => setSel(sel === m.id ? null : m.id)} aria-label={`Editar mesa ${m.nombre}, ${m.forma}, ${m.lugares} lugares${m.activa ? "" : ", fuera de servicio"}`}>
            <span className="dib"><MesaDibujo forma={m.forma} lugares={m.lugares} /><span className="num-mesa" translate="no">{m.nombre}</span></span>
            <span className="pie"><span>{m.lugares} lugares</span>{!m.activa && <span className="sello-mini">Fuera</span>}</span>
          </button>
        ))}
        <button type="button" className="mesa-ficha agregar" aria-pressed={sel === "nueva"} onClick={() => setSel(sel === "nueva" ? null : "nueva")}>
          <span className="mas-grande"><Icono n="mas" tam={30} /></span>
          <span className="pie"><span>Agregar mesa</span></span>
        </button>
      </div>

      {(sel === "nueva" || actual) && (
        <EditorMesa key={sel} inicial={actual ?? { nombre: siguiente, forma: "cuadrada", lugares: 4, activa: true }}
          onCancelar={() => setSel(null)}
          onGuardar={async (v) => {
            const ok = actual
              ? await hacer(() => supabase.from("mesas").update(v).eq("id", actual.id), `Mesa ${v.nombre} guardada`)
              : await hacer(() => supabase.from("mesas").insert({ ...v, restaurante_id: rid, orden: mesas.length }), `Mesa ${v.nombre} agregada`);
            if (ok) setSel(actual ? null : "nueva");
          }}
          onMover={actual ? (d) => mover(actual.id, d) : undefined}
          onBorrar={actual ? async () => { if (await hacer(() => supabase.from("mesas").delete().eq("id", actual.id), `Mesa ${actual.nombre} borrada`)) setSel(null); } : undefined} />
      )}
    </div>
  );
}

type Valores = { nombre: string; forma: Forma; lugares: number; activa: boolean };
function EditorMesa({ inicial, onGuardar, onCancelar, onBorrar, onMover }: { inicial: Valores; onGuardar: (v: Valores) => Promise<void>; onCancelar: () => void; onBorrar?: () => Promise<void>; onMover?: (d: -1 | 1) => void }) {
  const [nombre, setNombre] = useState(inicial.nombre);
  const [forma, setForma] = useState<Forma>(inicial.forma);
  const [lugares, setLugares] = useState(inicial.lugares);
  const [activa, setActiva] = useState(inicial.activa);
  const [enviando, setEnviando] = useState(false);
  const min = forma === "larga" ? 4 : 1, max = forma === "larga" ? 12 : forma === "redonda" ? 8 : 8;
  useEffect(() => { setLugares((l) => Math.min(max, Math.max(min, l))); }, [min, max]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setEnviando(true);
    await onGuardar({ nombre: nombre.trim(), forma, lugares, activa });
    setEnviando(false);
  }
  return (
    <form className="editor editor-mesa entra" onSubmit={enviar}>
      <div className={"editor-mesa-dib " + forma}><MesaDibujo forma={forma} lugares={lugares} ocupadas={lugares} conNumeros /></div>
      <div className="pila">
        <div className="editor-fila">
          <label className="campo nombre-mesa"><span>Nombre</span>
            <input className="entrada num" maxLength={20} required value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" name="mesa" placeholder="12, Barra 1, Terraza 3…" />
          </label>
          <div className="campo"><span>Lugares</span><Paso etiqueta="Lugares" valor={lugares} min={min} max={max} onCambio={setLugares} /></div>
        </div>
        <div className="campo"><span>Forma</span><Segmento etiqueta="Forma" valor={forma} onCambio={setForma} opciones={FORMAS} /></div>
        <label className="interruptor">
          <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
          <span className="riel" aria-hidden="true"><i /></span>
          <span>{activa ? "En servicio" : "Fuera de servicio"}</span>
        </label>
        <div className="editor-acc">
          <button className="primario" type="submit" disabled={enviando || !nombre.trim()}>{enviando ? "Guardando…" : onBorrar ? "Guardar" : "Agregar"}</button>
          <button className="secundario" type="button" onClick={onCancelar}>{onBorrar ? "Cancelar" : "Listo"}</button>
          {onMover && <>
            <button className="icono-b" type="button" onClick={() => onMover(-1)} aria-label="Mover antes"><Icono n="arriba" /></button>
            <button className="icono-b" type="button" onClick={() => onMover(1)} aria-label="Mover después"><Icono n="abajo" /></button>
          </>}
          {onBorrar && <span className="editor-extra"><DobleToque texto="Borrar" pregunta="¿Borrar? Toca otra vez" onConfirmar={onBorrar} /></span>}
        </div>
      </div>
    </form>
  );
}
