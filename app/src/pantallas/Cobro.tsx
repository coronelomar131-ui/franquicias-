import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSesion } from "../estado/sesion";
import type { Mesa, Metodo, Orden, Renglon, ResultadoCobro } from "../lib/tipos";
import type { Ruta } from "../lib/ruta";
import { aCentavos, mensajeError, pesos } from "../lib/formato";
import { useAviso } from "../componentes/Aviso";
import { Segmento } from "../componentes/Controles";
import { Icono } from "../componentes/Icono";
import { Ticket, imprimir, type LineaTicket } from "../componentes/Ticket";

const METODOS: { id: Metodo; texto: string }[] = [
  { id: "efectivo", texto: "Efectivo" }, { id: "tarjeta", texto: "Tarjeta" }, { id: "transferencia", texto: "Transfer." },
];
const NOMBRE_METODO: Record<Metodo, string> = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };
type Propina = "0" | "10" | "15" | "otra";

/** Junta renglones iguales para el ticket: 2 × Café en vez de dos líneas sueltas. */
function agrupar(rs: Renglon[]): LineaTicket[] {
  const m = new Map<string, LineaTicket>();
  for (const r of rs) {
    const k = r.nombre + "|" + r.precio_centavos;
    const x = m.get(k);
    if (x) { x.cantidad += r.cantidad; x.importe += r.cantidad * r.precio_centavos; }
    else m.set(k, { cantidad: r.cantidad, nombre: r.nombre, importe: r.cantidad * r.precio_centavos });
  }
  return [...m.values()];
}

export function Cobro({ ordenId, ir }: { ordenId: string; ir: (r: Ruta, param?: string) => void }) {
  const { actual } = useSesion();
  const avisar = useAviso();
  const [orden, setOrden] = useState<Orden | null>(null);
  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [renglones, setRenglones] = useState<Renglon[] | null>(null);
  const [modo, setModo] = useState<"todo" | "comensal">("todo");
  const [elegidos, setElegidos] = useState<number[]>([]);
  const [propina, setPropina] = useState<Propina>("0");
  const [propinaOtra, setPropinaOtra] = useState("");
  const [metodo, setMetodo] = useState<Metodo>("efectivo");
  const [recibido, setRecibido] = useState("");
  const [cobrando, setCobrando] = useState(false);
  const [hecho, setHecho] = useState<{ r: ResultadoCobro; lineas: LineaTicket[]; metodo: Metodo; recibido: number | null; quien: string } | null>(null);

  const cargar = useCallback(async () => {
    const { data: o, error } = await supabase.from("ordenes").select("id, restaurante_id, mesa_id, folio, comensales, estado, abierta_en").eq("id", ordenId).single();
    if (error) throw error;
    const [m, rs] = await Promise.all([
      o.mesa_id ? supabase.from("mesas").select("*").eq("id", o.mesa_id).single() : Promise.resolve({ data: null, error: null }),
      supabase.from("renglones").select("*").eq("orden_id", ordenId).eq("cancelado", false).order("comensal").order("creado_en"),
    ]);
    if (rs.error) throw rs.error;
    setOrden(o as Orden); setMesa((m.data as Mesa | null) ?? null); setRenglones((rs.data ?? []) as Renglon[]);
  }, [ordenId]);
  useEffect(() => { cargar().catch((e) => { avisar(mensajeError(e), "error"); setRenglones([]); }); }, [cargar, avisar]);

  const pendientes = useMemo(() => (renglones ?? []).filter((r) => !r.pagado), [renglones]);
  const sinMandar = pendientes.some((r) => !r.comanda_id);
  const porComensal = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of pendientes) m.set(r.comensal, (m.get(r.comensal) ?? 0) + r.precio_centavos * r.cantidad);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [pendientes]);
  // Al cambiar a "por comensal" se propone el primero que debe algo
  useEffect(() => { if (modo === "comensal" && !elegidos.length && porComensal.length) setElegidos([porComensal[0][0]]); }, [modo, porComensal, elegidos.length]);

  const seleccion = modo === "todo" ? pendientes : pendientes.filter((r) => elegidos.includes(r.comensal));
  const subtotal = seleccion.reduce((s, r) => s + r.precio_centavos * r.cantidad, 0);
  const montoPropina = propina === "otra" ? (aCentavos(propinaOtra) ?? 0) : Math.round((subtotal * Number(propina)) / 100 / 100) * 100;
  const total = subtotal + montoPropina;
  const recibidoC = aCentavos(recibido);
  const cambio = recibidoC !== null ? recibidoC - total : null;
  const listo = subtotal > 0 && !sinMandar && (metodo !== "efectivo" || (recibidoC !== null && recibidoC >= total));
  // Billetes que tiene sentido ofrecer: el exacto y los que alcanzan
  const billetes = [10000, 20000, 50000, 100000].filter((b) => b > total).slice(0, 3);

  async function cobrar() {
    if (!listo || !orden) return;
    setCobrando(true);
    const { data, error } = await supabase.rpc("cobrar", {
      p_orden: orden.id, p_metodo: metodo, p_propina: montoPropina,
      p_recibido: metodo === "efectivo" ? recibidoC : null,
      p_comensales: modo === "todo" ? null : elegidos,
    });
    setCobrando(false);
    if (error) { avisar(mensajeError(error), "error"); return; }
    const quien = modo === "todo" ? "" : elegidos.length === 1 ? `Comensal ${elegidos[0]}` : `Comensales ${elegidos.join(", ")}`;
    setHecho({ r: data as ResultadoCobro, lineas: agrupar(seleccion), metodo, recibido: metodo === "efectivo" ? recibidoC : null, quien });
    // Lo que quede se cobra junto; si quieren dividir otra vez, cambian a "Por comensal"
    setRecibido(""); setElegidos([]); setModo("todo"); setPropina("0"); setPropinaOtra("");
    await cargar().catch(() => {});
  }

  if (renglones === null) return <div className="cobro"><p className="sub espera" style={{ padding: "24px var(--m)" }}>Abriendo la cuenta…</p></div>;
  const nombreMesa = mesa ? `Mesa ${mesa.nombre}` : `Folio ${orden?.folio ?? ""}`;

  // ── Cobrado: ticket y siguiente paso ──
  if (hecho) {
    const { r } = hecho;
    const filas: [string, string, boolean?][] = [["Subtotal", pesos(r.total)]];
    if (r.propina) filas.push(["Propina", pesos(r.propina)]);
    const pie = (
      <>
        <div className="tk-fila"><span>{NOMBRE_METODO[hecho.metodo]}</span><span>{pesos(hecho.recibido ?? r.total + r.propina)}</span></div>
        {hecho.metodo === "efectivo" && <div className="tk-fila"><span>Cambio</span><span>{pesos(r.cambio)}</span></div>}
        <p>¡Gracias por su visita!</p>
        <p className="tk-chico">Este ticket no es un comprobante fiscal.</p>
      </>
    );
    return (
      <div className="cobro">
        <div className="cobrado entra">
          <span className="cobrado-ok" aria-hidden="true"><Icono n="ok" tam={34} /></span>
          <h1 className="titulo" tabIndex={-1}>Cobrado</h1>
          {hecho.metodo === "efectivo" && <p className="cambio-grande">Cambio <strong>{pesos(r.cambio)}</strong></p>}
          <p className="sub">{r.cerrada ? `${nombreMesa} queda libre.` : `Falta por cobrar ${pesos(r.restan)} de ${nombreMesa}.`}</p>
        </div>
        <div className="cobro-ticket">
          <Ticket restaurante={actual} titulo={nombreMesa} subtitulo={[hecho.quien, `Folio ${orden?.folio}`].filter(Boolean).join(" · ")}
            lineas={hecho.lineas} filas={filas} total={["Total", r.total + r.propina]} pie={pie} />
        </div>
        <div className="cobro-acc">
          <button type="button" className="secundario" onClick={imprimir}><Icono n="imprimir" tam={20} />Imprimir ticket</button>
          {r.cerrada
            ? <button type="button" className="primario" onClick={() => ir("salon")}>Listo</button>
            : <button type="button" className="primario" onClick={() => setHecho(null)}>Cobrar lo que falta</button>}
        </div>
      </div>
    );
  }

  if (!pendientes.length) return (
    <div className="cobro"><div className="encabezado"><h1 className="titulo" tabIndex={-1}>Nada por cobrar</h1>
      <p className="sub">{orden?.estado === "pagada" ? "Esta cuenta ya está pagada." : "La cuenta no tiene platillos."}</p>
      <button className="secundario" type="button" onClick={() => ir("salon")}>Volver al salón</button></div></div>
  );

  return (
    <div className="cobro">
      <button type="button" className="vuelta" onClick={() => ir("pedido", ordenId)}><Icono n="atras" tam={20} />{nombreMesa}</button>
      <div className="encabezado">
        <h1 className="titulo" tabIndex={-1}>Cobrar</h1>
        <p className="sub">{nombreMesa} · Folio {orden?.folio} · Por cobrar <b>{pesos(pendientes.reduce((s, r) => s + r.precio_centavos * r.cantidad, 0))}</b></p>
      </div>

      {sinMandar && (
        <div className="aviso-cobro">
          <p>Hay platillos que no se han mandado a cocina. Mándalos o quítalos antes de cobrar.</p>
          <button type="button" className="secundario" onClick={() => ir("pedido", ordenId)}>Ir al pedido</button>
        </div>
      )}

      <div className="cobro-cuerpo">
        <div className="pila">
          <div className="campo"><span>Qué se cobra</span>
            <Segmento etiqueta="Qué se cobra" valor={modo} onCambio={(m) => { setModo(m); setElegidos([]); }}
              opciones={[{ id: "todo", texto: "Toda la cuenta" }, { id: "comensal", texto: "Por comensal" }]} />
          </div>
          {modo === "comensal" && (
            <div className="quienes" role="group" aria-label="Comensales que pagan">
              {porComensal.map(([n, imp]) => (
                <button key={n} type="button" className="quien" aria-pressed={elegidos.includes(n)}
                  onClick={() => setElegidos((e) => (e.includes(n) ? e.filter((x) => x !== n) : [...e, n].sort((a, b) => a - b)))}>
                  <b>{n}</b><span>{pesos(imp)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="campo"><span>Propina</span>
            <Segmento etiqueta="Propina" valor={propina} onCambio={setPropina}
              opciones={[{ id: "0", texto: "Sin" }, { id: "10", texto: "10%" }, { id: "15", texto: "15%" }, { id: "otra", texto: "Otra" }]} />
          </div>
          {propina === "otra" && (
            <label className="campo"><span>Propina en pesos</span>
              <input className="entrada num" inputMode="decimal" value={propinaOtra} onChange={(e) => setPropinaOtra(e.target.value)} placeholder="50" />
            </label>
          )}

          <div className="campo"><span>Forma de pago</span>
            <Segmento etiqueta="Forma de pago" valor={metodo} onCambio={setMetodo} opciones={METODOS} />
          </div>
          {metodo === "efectivo" && (
            <div className="campo"><span>Te dieron</span>
              <div className="billetes">
                <button type="button" className="billete" onClick={() => setRecibido(String(total / 100))}>Exacto</button>
                {billetes.map((b) => <button key={b} type="button" className="billete" onClick={() => setRecibido(String(b / 100))}>{pesos(b)}</button>)}
              </div>
              <input className="entrada num" inputMode="decimal" value={recibido} onChange={(e) => setRecibido(e.target.value)} placeholder="Cuánto te dieron" aria-label="Cuánto te dieron" />
              {cambio !== null && (
                <p className={"cambio" + (cambio < 0 ? " falta" : "")} aria-live="polite">
                  {cambio < 0 ? <>Faltan <strong>{pesos(-cambio)}</strong></> : <>Cambio <strong>{pesos(cambio)}</strong></>}
                </p>
              )}
            </div>
          )}
        </div>

        <aside className="cobro-resumen">
          <div className="resumen-papel">
            {agrupar(seleccion).map((l, i) => (
              <div key={i} className="tk-linea"><span>{l.cantidad}</span><span>{l.nombre}</span><span>{pesos(l.importe)}</span></div>
            ))}
            {!seleccion.length && <p className="nota">Elige quién paga.</p>}
            <div className="tk-filas">
              <div className="tk-fila"><span>Subtotal</span><span>{pesos(subtotal)}</span></div>
              {montoPropina > 0 && <div className="tk-fila"><span>Propina</span><span>{pesos(montoPropina)}</span></div>}
            </div>
            <div className="tk-total"><span>Total</span><strong>{pesos(total)}</strong></div>
          </div>
          <button type="button" className="primario ancho cobrar-b" disabled={!listo || cobrando} onClick={cobrar}>
            {cobrando ? "Cobrando…" : `Cobrar ${pesos(total)}`}
          </button>
        </aside>
      </div>
    </div>
  );
}
