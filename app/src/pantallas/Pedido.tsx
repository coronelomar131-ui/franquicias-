import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Categoria, Comanda, Mesa, Orden, Producto, Renglon } from "../lib/tipos";
import type { Ruta } from "../lib/ruta";
import { mensajeError, minutosDesde, pesos } from "../lib/formato";
import { useAviso } from "../componentes/Aviso";
import { MesaDibujo } from "../componentes/MesaDibujo";
import { DobleToque, Segmento } from "../componentes/Controles";
import { Icono } from "../componentes/Icono";
import { useEquipo } from "../estado/equipo";

const poco = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Un papelito sale del botón y cae en la pestaña de Cocina. */
function volarACocina(origen: HTMLElement | null) {
  const destino = document.querySelector<HTMLElement>('.dock .pestana:nth-of-type(2)');
  if (!origen || !destino || poco()) return;
  const r = origen.getBoundingClientRect(), d = destino.getBoundingClientRect();
  const papel = document.createElement("div");
  papel.className = "papelito";
  papel.setAttribute("aria-hidden", "true");
  document.body.appendChild(papel);
  const x0 = r.left + r.width / 2 - 22, y0 = r.top + r.height / 2 - 28;
  const x1 = d.left + d.width / 2 - 22, y1 = d.top + d.height / 2 - 28;
  papel.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(1) rotate(0deg)`, opacity: 1 },
    { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 40}px) scale(0.85) rotate(-6deg)`, opacity: 1, offset: 0.45 },
    { transform: `translate(${x1}px, ${y1}px) scale(0.4) rotate(-10deg)`, opacity: 0 },
  ], { duration: 520, easing: "cubic-bezier(0.77, 0, 0.175, 1)", fill: "forwards" }).finished.finally(() => papel.remove());
}

export function Pedido({ rid, ordenId, ir }: { rid: string; ordenId: string; ir: (r: Ruta, param?: string) => void }) {
  const avisar = useAviso();
  const { persona } = useEquipo();
  const [orden, setOrden] = useState<Orden | null>(null);
  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [prods, setProds] = useState<Producto[]>([]);
  const [renglones, setRenglones] = useState<Renglon[]>([]);
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [cargando, setCargando] = useState(true);
  const [com, setCom] = useState(1);
  const [cat, setCat] = useState<string | null>(null);
  const [vista, setVista] = useState<"menu" | "comanda">("menu");
  const [enviando, setEnviando] = useState(false);
  const [nuevoId, setNuevoId] = useState<string | null>(null);
  const botonEnviar = useRef<HTMLButtonElement>(null);
  const barraEnviar = useRef<HTMLButtonElement>(null);

  const cargarCuenta = useCallback(async () => {
    const [r, c] = await Promise.all([
      supabase.from("renglones").select("*").eq("orden_id", ordenId).eq("cancelado", false).order("creado_en"),
      supabase.from("comandas").select("*").eq("orden_id", ordenId).order("ronda"),
    ]);
    if (r.error) throw r.error;
    if (c.error) throw c.error;
    setRenglones(r.data ?? []); setComandas(c.data ?? []);
  }, [ordenId]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data: o, error: e1 } = await supabase.from("ordenes").select("id, restaurante_id, mesa_id, folio, comensales, estado, abierta_en").eq("id", ordenId).single();
        if (e1) throw e1;
        const [m, c, p] = await Promise.all([
          o.mesa_id ? supabase.from("mesas").select("*").eq("id", o.mesa_id).single() : Promise.resolve({ data: null, error: null }),
          supabase.from("categorias").select("*").eq("restaurante_id", rid).eq("activa", true).order("orden").order("creado_en"),
          supabase.from("productos").select("*").eq("restaurante_id", rid).eq("activo", true).order("orden").order("creado_en"),
        ]);
        if (m.error) throw m.error;
        if (c.error) throw c.error;
        if (p.error) throw p.error;
        if (!vivo) return;
        setOrden(o); setMesa(m.data); setCats(c.data ?? []); setProds(p.data ?? []);
        setCat((c.data ?? [])[0]?.id ?? null);
        await cargarCuenta();
      } catch (e) { if (vivo) avisar(mensajeError(e), "error"); }
      finally { if (vivo) setCargando(false); }
    })();
    // Otro mesero puede agregar a la misma mesa, y cocina marca listas: se ve sin recargar
    const canal = supabase.channel("pedido-" + ordenId)
      .on("postgres_changes", { event: "*", schema: "public", table: "renglones", filter: "orden_id=eq." + ordenId }, () => { cargarCuenta().catch(() => {}); })
      .on("postgres_changes", { event: "*", schema: "public", table: "comandas", filter: "orden_id=eq." + ordenId }, () => { cargarCuenta().catch(() => {}); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ordenes", filter: "id=eq." + ordenId }, (pl) => { setOrden((o) => (o ? { ...o, ...(pl.new as Orden) } : o)); })
      .subscribe();
    return () => { vivo = false; supabase.removeChannel(canal); };
  }, [ordenId, rid, cargarCuenta, avisar]);

  if (cargando) return <div className="pedido"><p className="sub espera" style={{ padding: "24px var(--m)" }}>Abriendo la mesa…</p></div>;
  if (!orden) return (
    <div className="pedido"><div className="encabezado"><h1 className="titulo" tabIndex={-1}>Mesa no encontrada</h1>
      <button className="secundario" type="button" onClick={() => ir("salon")}>Volver al salón</button></div></div>
  );
  if (orden.estado !== "abierta") return (
    <div className="pedido"><div className="encabezado"><h1 className="titulo" tabIndex={-1}>Esta cuenta ya se cerró</h1>
      <button className="secundario" type="button" onClick={() => ir("salon")}>Volver al salón</button></div></div>
  );

  const nuevos = renglones.filter((r) => !r.comanda_id);
  const cuantosNuevos = nuevos.reduce((s, r) => s + r.cantidad, 0);
  const total = renglones.reduce((s, r) => s + r.precio_centavos * r.cantidad, 0);
  const totalNuevos = nuevos.reduce((s, r) => s + r.precio_centavos * r.cantidad, 0);
  const porCobrar = renglones.filter((r) => !r.pagado).reduce((s, r) => s + r.precio_centavos * r.cantidad, 0);
  const cuantos = (c: number) => renglones.filter((r) => r.comensal === c).reduce((s, r) => s + r.cantidad, 0);
  const llevaEste = (pid: string) => renglones.filter((r) => r.producto_id === pid && r.comensal === com).reduce((s, r) => s + r.cantidad, 0);
  const estadoComanda = (id: string | null) => comandas.find((c) => c.id === id)?.estado;

  async function agregar(p: Producto) {
    const existente = renglones.find((r) => !r.comanda_id && r.producto_id === p.id && r.comensal === com && !r.nota);
    if (existente) {
      setRenglones((rs) => rs.map((r) => (r.id === existente.id ? { ...r, cantidad: r.cantidad + 1 } : r)));
      const { error } = await supabase.from("renglones").update({ cantidad: Math.min(99, existente.cantidad + 1) }).eq("id", existente.id);
      if (error) { avisar(mensajeError(error), "error"); cargarCuenta().catch(() => {}); }
      return;
    }
    const temporal: Renglon = { id: "tmp-" + crypto.randomUUID(), restaurante_id: rid, orden_id: ordenId, producto_id: p.id, nombre: p.nombre, precio_centavos: p.precio_centavos, cantidad: 1, comensal: com, nota: "", comanda_id: null, pagado: false, cancelado: false, creado_en: new Date().toISOString() };
    setRenglones((rs) => [...rs, temporal]);
    setNuevoId(temporal.id);
    const { data, error } = await supabase.from("renglones")
      .insert({ restaurante_id: rid, orden_id: ordenId, producto_id: p.id, nombre: p.nombre, precio_centavos: p.precio_centavos, cantidad: 1, comensal: com })
      .select("*").single();
    if (error) { avisar(mensajeError(error), "error"); setRenglones((rs) => rs.filter((r) => r.id !== temporal.id)); return; }
    setRenglones((rs) => rs.map((r) => (r.id === temporal.id ? data : r)));
    setNuevoId(data.id);
  }

  async function quitar(r: Renglon) {
    if (r.comanda_id || r.id.startsWith("tmp-")) return;
    if (r.cantidad > 1) {
      setRenglones((rs) => rs.map((x) => (x.id === r.id ? { ...x, cantidad: x.cantidad - 1 } : x)));
      const { error } = await supabase.from("renglones").update({ cantidad: r.cantidad - 1 }).eq("id", r.id);
      if (error) { avisar(mensajeError(error), "error"); cargarCuenta().catch(() => {}); }
    } else {
      setRenglones((rs) => rs.filter((x) => x.id !== r.id));
      const { error } = await supabase.from("renglones").delete().eq("id", r.id);
      if (error) { avisar(mensajeError(error), "error"); cargarCuenta().catch(() => {}); }
    }
  }

  async function cambiarComensales(n: number) {
    if (!orden || n < 1 || n > 30) return;
    const { error } = await supabase.from("ordenes").update({ comensales: n }).eq("id", orden.id);
    if (error) { avisar(mensajeError(error), "error"); return; }
    setOrden({ ...orden, comensales: n });
    setCom(n);
  }

  async function enviar(desde: HTMLElement | null) {
    if (!cuantosNuevos || enviando) return;
    if (renglones.some((r) => r.id.startsWith("tmp-"))) { avisar("Un momento, terminando de guardar…"); return; }
    setEnviando(true);
    const { error } = await supabase.rpc("enviar_a_cocina", { p_orden: ordenId, p_empleado: persona?.id ?? null });
    setEnviando(false);
    if (error) { avisar(mensajeError(error), "error"); return; }
    volarACocina(desde);
    await cargarCuenta().catch(() => {});
    avisar(`Comanda de la mesa ${mesa?.nombre ?? ""} en cocina`);
  }

  async function liberar() {
    const { error } = await supabase.from("ordenes").update({ estado: "cancelada", cerrada_en: new Date().toISOString() }).eq("id", ordenId);
    if (error) { avisar(mensajeError(error), "error"); return; }
    avisar(`Mesa ${mesa?.nombre ?? ""} libre`);
    ir("salon");
  }

  const sinCategoria = prods.filter((p) => !p.categoria_id || !cats.some((c) => c.id === p.categoria_id));
  const chips = [...cats.map((c) => ({ id: c.id, nombre: c.nombre })), ...(cats.length && sinCategoria.length ? [{ id: "otros", nombre: "Otros" }] : [])];
  const visibles = !cats.length ? prods : cat === "otros" ? sinCategoria : prods.filter((p) => p.categoria_id === cat);
  const barraOculta = !(cuantosNuevos > 0 && vista === "menu");

  return (
    <div className="pedido">
      <button className="vuelta" type="button" onClick={() => ir("salon")}><Icono n="atras" /> Salón</button>
      <div className="cab-mesa">
        <h1 tabIndex={-1}>Mesa {mesa?.nombre ?? "—"}</h1>
        <span className="chip-e" data-estado={comandas.some((c) => c.estado === "pendiente") ? "preparando" : comandas.length ? "comiendo" : "ordenando"}>
          {comandas.some((c) => c.estado === "pendiente") ? "Preparando" : comandas.length ? "Comiendo" : "Ordenando"}
        </span>
        <div className="dato"><strong>{pesos(total)}</strong><span>Folio {orden.folio} · {minutosDesde(orden.abierta_en)} min</span></div>
      </div>

      <div className="mesa-top">
        {mesa && <div className={"dib-p " + mesa.forma} data-estado="ocupada"><MesaDibujo forma={mesa.forma} lugares={mesa.lugares} ocupadas={Math.min(orden.comensales, mesa.lugares)} activa={com} conNumeros /></div>}
        <div className="comensales" role="radiogroup" aria-label="Comensal al que se le agrega">
          {Array.from({ length: orden.comensales }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" role="radio" aria-checked={com === n} className="com" onClick={() => setCom(n)} aria-label={`Comensal ${n}, ${cuantos(n)} productos`}>
              <b>{n}</b><small>{cuantos(n) ? cuantos(n) + " prod." : "vacío"}</small>
            </button>
          ))}
          <button type="button" className="com otro" onClick={() => cambiarComensales(orden.comensales + 1)} aria-label="Agregar comensal"><Icono n="mas" /></button>
        </div>
      </div>

      <div className="pedido-cuerpo" data-vista={vista}>
        <div className="pedido-seg">
          <Segmento etiqueta="Ver" valor={vista} onCambio={setVista}
            opciones={[{ id: "menu", texto: "Menú" }, { id: "comanda", texto: <>Comanda{renglones.length ? <span className="cuenta"> · {renglones.reduce((s, r) => s + r.cantidad, 0)}</span> : null}</> }]} />
        </div>
        <div className="pedido-cols">
          <section className="pedido-menu" aria-label="Menú">
            {chips.length > 0 && (
              <div className="cats" role="group" aria-label="Categoría">
                {chips.map((c) => <button key={c.id} type="button" className="cat" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.nombre}</button>)}
              </div>
            )}
            {prods.length === 0 ? (
              <div className="vacio-grande"><strong>El menú está vacío</strong><p>Agrega tus platillos en la pestaña Menú y aquí aparecen para tomar el pedido.</p>
                <button className="secundario" type="button" onClick={() => ir("menu")}>Ir al menú</button></div>
            ) : (
              <ul className="platillos">
                {visibles.map((p) => {
                  const lleva = llevaEste(p.id);
                  return (
                    <li key={p.id}>
                      <button type="button" className={"platillo" + (p.foto_url ? " con-foto" : "")} onClick={() => agregar(p)} aria-label={`Agregar ${p.nombre} al comensal ${com}${lleva ? `, lleva ${lleva}` : ""}`}>
                        {p.foto_url && <img className="platillo-foto" src={p.foto_url} alt="" loading="lazy" width={64} height={64} />}
                        <span className="nom">{p.nombre}</span>
                        {p.descripcion && <span className="desc">{p.descripcion}</span>}
                        <span className="precio">{pesos(p.precio_centavos)}</span>
                        <span className={"accion" + (lleva ? " tiene" : "")}>{lleva ? lleva : <Icono n="mas" />}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="pedido-comanda" aria-label="Comanda">
            {renglones.length === 0 && <div className="vacia"><strong>Sin productos</strong>Elige al comensal arriba y toca un platillo del menú.</div>}
            {Array.from({ length: orden.comensales }, (_, i) => i + 1).map((n) => {
              const ls = renglones.filter((r) => r.comensal === n);
              if (!ls.length) return null;
              return (
                <div key={n} className="grupo">
                  <h3>Comensal {n}<span>{pesos(ls.reduce((s, r) => s + r.precio_centavos * r.cantidad, 0))}</span></h3>
                  {ls.map((r) => (
                    <div key={r.id} className={"linea" + (r.id === nuevoId ? " entra" : "")}>
                      <span className="cant">{r.cantidad}</span>
                      <span className="nom">{r.nombre}</span>
                      <span className="imp">{pesos(r.precio_centavos * r.cantidad)}</span>
                      {r.comanda_id
                        ? <span className={"tag" + (r.pagado ? " pagada" : "")}>{r.pagado ? "Pagado" : estadoComanda(r.comanda_id) === "lista" ? "Lista" : "En cocina"}</span>
                        : <button type="button" className="quitar" onClick={() => quitar(r)} aria-label={`Quitar un ${r.nombre} del comensal ${n}`} disabled={r.id.startsWith("tmp-")}><Icono n="menos" /></button>}
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="total-com"><span>Total</span><strong>{pesos(total)}</strong></div>
            {porCobrar > 0 && porCobrar < total && <div className="total-com por-cobrar"><span>Falta por cobrar</span><strong>{pesos(porCobrar)}</strong></div>}
            <div className="acciones">
              <button ref={botonEnviar} className="primario" type="button" disabled={!cuantosNuevos || enviando} onClick={() => enviar(botonEnviar.current)}>
                <Icono n="enviar" tam={20} />{enviando ? "Enviando…" : cuantosNuevos ? `Mandar a cocina · ${cuantosNuevos}` : "Mandar a cocina"}
              </button>
              {porCobrar > 0 && !cuantosNuevos && (
                <button className="primario cobrar-pedido" type="button" onClick={() => ir("cobro", ordenId)}><Icono n="caja" tam={20} />Cobrar · {pesos(porCobrar)}</button>
              )}
              {comandas.length === 0 && <DobleToque texto="Liberar mesa" pregunta="¿Liberar? Toca otra vez" onConfirmar={liberar} />}
            </div>
          </section>
        </div>
      </div>

      <div className="barra vidrio" data-oculta={barraOculta} {...((barraOculta ? { inert: "" } : {}) as Record<string, string>)}>
        <p>{cuantosNuevos} {cuantosNuevos === 1 ? "producto nuevo" : "productos nuevos"}<small>Mesa {mesa?.nombre} · {pesos(totalNuevos)}</small></p>
        <button ref={barraEnviar} className="primario" type="button" disabled={enviando} onClick={() => enviar(barraEnviar.current)}>{enviando ? "…" : "Mandar"}</button>
      </div>
    </div>
  );
}
