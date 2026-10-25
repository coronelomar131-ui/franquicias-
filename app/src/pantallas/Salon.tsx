import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Mesa, Orden } from "../lib/tipos";
import type { Ruta } from "../lib/ruta";
import { mensajeError, minutosDesde } from "../lib/formato";
import { useAviso } from "../componentes/Aviso";
import { MesaDibujo } from "../componentes/MesaDibujo";
import { DobleToque, Paso } from "../componentes/Controles";
import { Icono } from "../componentes/Icono";

export function Salon({ rid, irA }: { rid: string; irA: (r: Ruta) => void }) {
  const avisar = useAviso();
  const [mesas, setMesas] = useState<Mesa[] | null>(null);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [comensales, setComensales] = useState(2);
  const [trabajando, setTrabajando] = useState(false);
  const [, setTic] = useState(0);
  const [recien, setRecien] = useState<Set<string>>(new Set());
  const ordenesRef = useRef<Orden[] | null>(null);
  const marcarRecien = useCallback((id: string) => {
    setRecien((s) => new Set(s).add(id));
    window.setTimeout(() => setRecien((s) => { const n = new Set(s); n.delete(id); return n; }), 900);
  }, []);

  const cargarOrdenes = useCallback(async () => {
    const { data, error } = await supabase.from("ordenes").select("id, restaurante_id, mesa_id, folio, comensales, estado, abierta_en").eq("restaurante_id", rid).eq("estado", "abierta");
    if (error) throw error;
    const antes = ordenesRef.current;
    if (antes) {
      const ocupadasAntes = new Set(antes.map((o) => o.mesa_id));
      (data ?? []).forEach((o) => { if (o.mesa_id && !ocupadasAntes.has(o.mesa_id)) marcarRecien(o.mesa_id); });
    }
    ordenesRef.current = data ?? [];
    setOrdenes(data ?? []);
  }, [rid, marcarRecien]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data, error } = await supabase.from("mesas").select("*").eq("restaurante_id", rid).eq("activa", true).order("orden").order("creado_en");
        if (error) throw error;
        if (vivo) setMesas(data ?? []);
        await cargarOrdenes();
      } catch (e) { if (vivo) { setMesas([]); avisar(mensajeError(e), "error"); } }
    })();
    // Otros aparatos abren y cierran mesas: el salón se entera solo
    const canal = supabase.channel("salon-" + rid)
      .on("postgres_changes", { event: "*", schema: "public", table: "ordenes", filter: "restaurante_id=eq." + rid }, () => { cargarOrdenes().catch(() => {}); })
      .subscribe();
    const reloj = window.setInterval(() => setTic((t) => t + 1), 30000);
    return () => { vivo = false; supabase.removeChannel(canal); window.clearInterval(reloj); };
  }, [rid, cargarOrdenes, avisar]);

  const ordenDe = (mid: string) => ordenes.find((o) => o.mesa_id === mid);
  const mesaSel = mesas?.find((m) => m.id === sel) ?? null;
  const ordenSel = mesaSel ? ordenDe(mesaSel.id) : undefined;

  function elegir(m: Mesa) {
    if (sel === m.id) { setSel(null); return; }
    setSel(m.id);
    setComensales(Math.min(2, m.lugares));
  }

  async function abrir() {
    if (!mesaSel) return;
    setTrabajando(true);
    try {
      const { error } = await supabase.from("ordenes").insert({ restaurante_id: rid, mesa_id: mesaSel.id, comensales });
      if (error) throw error;
      await cargarOrdenes();
      avisar(`Mesa ${mesaSel.nombre} abierta · ${comensales} ${comensales === 1 ? "comensal" : "comensales"}`);
    } catch (e) { avisar(mensajeError(e), "error"); }
    finally { setTrabajando(false); }
  }

  async function liberar() {
    if (!ordenSel || !mesaSel) return;
    setTrabajando(true);
    try {
      const { error } = await supabase.from("ordenes").update({ estado: "cancelada", cerrada_en: new Date().toISOString() }).eq("id", ordenSel.id);
      if (error) throw error;
      await cargarOrdenes();
      setSel(null);
      avisar(`Mesa ${mesaSel.nombre} libre`);
    } catch (e) { avisar(mensajeError(e), "error"); }
    finally { setTrabajando(false); }
  }

  if (mesas === null) return <div className="salon"><h1 className="titulo" tabIndex={-1}>Salón</h1><p className="sub">Cargando mesas…</p></div>;

  const ocupadas = mesas.filter((m) => ordenDe(m.id)).length;
  return (
    <div className="salon">
      <div className="encabezado">
        <h1 className="titulo" tabIndex={-1}>Salón</h1>
        {mesas.length > 0 && <p className="sub"><b>{ocupadas}</b> de {mesas.length} mesas ocupadas</p>}
      </div>

      {mesas.length === 0 ? (
        <div className="vacio-grande">
          <MesaDibujo forma="larga" lugares={6} />
          <strong>Tu salón está vacío</strong>
          <p>Dibuja tus mesas una vez, con su forma y sus lugares. Después aquí ves cuáles están libres y cuáles ocupadas.</p>
          <button className="primario" type="button" onClick={() => irA("mesas")}>Agregar mesas</button>
        </div>
      ) : (
        <div className="plano">
          <span className="plano-nota pase" aria-hidden="true">Pase a cocina</span>
          <span className="plano-nota escala" aria-hidden="true"><i />1 m</span>
          {mesas.map((m, i) => {
            const o = ordenDe(m.id);
            const nueva = recien.has(m.id);
            return (
              <button key={m.id} type="button" className={"mesa " + m.forma + (nueva ? " recien" : "")} style={{ ["--i" as string]: i }}
                data-estado={o ? "ocupada" : "libre"} aria-pressed={sel === m.id} onClick={() => elegir(m)}
                aria-label={`Mesa ${m.nombre}, ${o ? `ocupada, ${o.comensales} comensales, ${minutosDesde(o.abierta_en)} minutos` : `libre, ${m.lugares} lugares`}`}>
                <span className="dib">
                  <MesaDibujo forma={m.forma} lugares={m.lugares} ocupadas={o ? Math.min(o.comensales, m.lugares) : 0} />
                  <span className="num" translate="no">{m.nombre}</span>
                </span>
                <span className="pie">
                  <b>{o ? "Ocupada" : "Libre"}</b>
                  <span>{o ? `${o.comensales} ${o.comensales === 1 ? "persona" : "personas"} · ${minutosDesde(o.abierta_en)} min` : `${m.lugares} lugares`}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {mesas.length > 0 && (
        <ul className="leyenda" aria-label="Estados">
          <li><i style={{ background: "var(--e-libre)" }} />Libre</li>
          <li><i style={{ background: "var(--e-ocupada)" }} />Ocupada</li>
        </ul>
      )}

      {mesaSel && (
        <section key={mesaSel.id} className="hoja vidrio entra" aria-label={`Mesa ${mesaSel.nombre}`}>
          <div className="hoja-cab">
            <div>
              <span className="sobre">{ordenSel ? `Folio ${ordenSel.folio}` : `${mesaSel.lugares} lugares`}</span>
              <h2>Mesa {mesaSel.nombre}</h2>
            </div>
            <button className="icono-b" type="button" onClick={() => setSel(null)} aria-label="Cerrar"><Icono n="cerrar" /></button>
          </div>
          {ordenSel ? (
            <>
              <p className="hoja-dato"><b>{ordenSel.comensales}</b> {ordenSel.comensales === 1 ? "comensal" : "comensales"} · abierta hace <b>{minutosDesde(ordenSel.abierta_en)}</b> min</p>
              <p className="nota">Tomar el pedido, mandar a cocina y cobrar llegan en la siguiente entrega.</p>
              <DobleToque texto="Liberar mesa" pregunta="¿Liberar? Toca otra vez" onConfirmar={liberar} disabled={trabajando} />
            </>
          ) : (
            <div className="hoja-abrir">
              <div className="campo"><span>Comensales</span>
                <Paso etiqueta="Comensales" valor={comensales} min={1} max={Math.max(mesaSel.lugares, 1)} onCambio={setComensales} />
              </div>
              <button className="primario" type="button" onClick={abrir} disabled={trabajando}>{trabajando ? "Abriendo…" : "Abrir mesa"}</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
