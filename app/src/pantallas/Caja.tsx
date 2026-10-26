import { useCallback, useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useSesion } from "../estado/sesion";
import type { ResumenTurno, Turno } from "../lib/tipos";
import { aCentavos, mensajeError, pesos } from "../lib/formato";
import { useAviso } from "../componentes/Aviso";
import { Icono } from "../componentes/Icono";
import { Ticket, imprimir } from "../componentes/Ticket";

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" });
const dia = (iso: string) => { const t = new Date(iso).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" }); return t.charAt(0).toUpperCase() + t.slice(1); };

/** Caja: abrir con fondo, ver el turno en vivo y hacer el corte. */
export function Caja({ rid }: { rid: string }) {
  const avisar = useAviso();
  const [abierto, setAbierto] = useState<Turno | null | undefined>(undefined);
  const [resumen, setResumen] = useState<ResumenTurno | null>(null);
  const [historial, setHistorial] = useState<Turno[]>([]);
  const [corte, setCorte] = useState<ResumenTurno | null>(null);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from("turnos").select("*").eq("restaurante_id", rid).order("abierto_en", { ascending: false }).limit(15);
    if (error) throw error;
    const ts = (data ?? []) as Turno[];
    const a = ts.find((t) => !t.cerrado_en) ?? null;
    setAbierto(a); setHistorial(ts.filter((t) => t.cerrado_en));
    if (a) {
      const { data: r, error: e2 } = await supabase.rpc("resumen_turno", { p_turno: a.id });
      if (e2) throw e2;
      setResumen(r as ResumenTurno);
    } else setResumen(null);
  }, [rid]);

  useEffect(() => {
    cargar().catch((e) => { avisar(mensajeError(e), "error"); setAbierto(null); });
    // Cada cobro mueve los números al momento
    const canal = supabase.channel("caja-" + rid)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pagos", filter: "restaurante_id=eq." + rid }, () => { cargar().catch(() => {}); })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [rid, cargar, avisar]);

  async function verCorte(t: Turno) {
    const { data, error } = await supabase.rpc("resumen_turno", { p_turno: t.id });
    if (error) { avisar(mensajeError(error), "error"); return; }
    setCorte(data as ResumenTurno);
  }

  if (corte) return <HojaCorte r={corte} onListo={() => setCorte(null)} />;
  if (abierto === undefined) return <div className="caja"><h1 className="titulo" tabIndex={-1}>Caja</h1><p className="sub espera">Cargando…</p></div>;

  return (
    <div className="caja">
      <div className="encabezado">
        <h1 className="titulo" tabIndex={-1}>Caja</h1>
        <p className="sub">{abierto ? <>Abierta desde las <b>{hora(abierto.abierto_en)}</b>{resumen?.abierto_por ? ` por ${resumen.abierto_por.split(" ")[0]}` : ""}</> : "La caja está cerrada."}</p>
      </div>
      {abierto && resumen
        ? <TurnoAbierto t={abierto} r={resumen} onCerrado={(r) => { setCorte(r); cargar().catch(() => {}); }} onCambio={() => cargar().catch(() => {})} />
        : <AbrirCaja rid={rid} onAbierta={() => cargar().catch(() => {})} />}

      {historial.length > 0 && (
        <section className="historial" aria-labelledby="hist-t">
          <h2 id="hist-t">Cortes anteriores</h2>
          <ul>
            {historial.map((t) => (
              <li key={t.id}>
                <button type="button" className="fila-corte" onClick={() => verCorte(t)}>
                  <span><b>{dia(t.abierto_en)}</b><small>{hora(t.abierto_en)} a {hora(t.cerrado_en!)}</small></span>
                  <span className="dif">{t.efectivo_contado_centavos !== null ? `Contado ${pesos(t.efectivo_contado_centavos)}` : ""}</span>
                  <Icono n="adelante" tam={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AbrirCaja({ rid, onAbierta }: { rid: string; onAbierta: () => void }) {
  const avisar = useAviso();
  const [fondo, setFondo] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const { error } = await supabase.rpc("abrir_turno", { p_restaurante: rid, p_fondo: aCentavos(fondo) ?? 0 });
    setEnviando(false);
    if (error) { avisar(mensajeError(error), "error"); return; }
    avisar("Caja abierta"); onAbierta();
  }
  return (
    <form className="abrir-caja entra" onSubmit={enviar}>
      <label className="campo"><span>Fondo de caja</span>
        <input className="entrada num" inputMode="decimal" value={fondo} onChange={(e) => setFondo(e.target.value)} placeholder="500" />
      </label>
      <p className="nota">El efectivo con el que empiezas, para dar cambio. Si no abres caja, se abre sola en cero con el primer cobro.</p>
      <button className="primario" type="submit" disabled={enviando}>{enviando ? "Abriendo…" : "Abrir caja"}</button>
    </form>
  );
}

function TurnoAbierto({ t, r, onCerrado, onCambio }: { t: Turno; r: ResumenTurno; onCerrado: (r: ResumenTurno) => void; onCambio: () => void }) {
  const avisar = useAviso();
  const [contando, setContando] = useState(false);
  const [contado, setContado] = useState("");
  const [notas, setNotas] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [fondoNuevo, setFondoNuevo] = useState<string | null>(null);
  const contadoC = aCentavos(contado);
  const diferencia = contadoC !== null ? contadoC - r.esperado : null;
  const total = r.efectivo + r.tarjeta + r.transferencia;

  async function cerrar(e: FormEvent) {
    e.preventDefault();
    if (contadoC === null) return;
    setCerrando(true);
    const { data, error } = await supabase.rpc("cerrar_turno", { p_turno: t.id, p_contado: contadoC, p_notas: notas.trim() });
    setCerrando(false);
    if (error) { avisar(mensajeError(error), "error"); return; }
    onCerrado(data as ResumenTurno);
  }
  async function guardarFondo() {
    const { error } = await supabase.rpc("poner_fondo", { p_turno: t.id, p_fondo: aCentavos(fondoNuevo ?? "") ?? 0 });
    if (error) { avisar(mensajeError(error), "error"); return; }
    setFondoNuevo(null); onCambio();
  }

  return (
    <div className="turno entra">
      <div className="cifras">
        <div className="cifra grande"><span>Ventas</span><strong>{pesos(r.ventas)}</strong><small>{r.cuentas} {r.cuentas === 1 ? "cuenta cobrada" : "cuentas cobradas"}</small></div>
        <div className="cifra"><span>Propinas</span><strong>{pesos(r.propinas)}</strong></div>
        <div className="cifra"><span>Por cobrar</span><strong>{pesos(r.por_cobrar)}</strong><small>{r.abiertas} {r.abiertas === 1 ? "mesa abierta" : "mesas abiertas"}</small></div>
      </div>

      <div className="metodos">
        {([["Efectivo", r.efectivo], ["Tarjeta", r.tarjeta], ["Transferencia", r.transferencia]] as [string, number][]).map(([n, v]) => (
          <div key={n} className="metodo">
            <div className="metodo-txt"><span>{n}</span><b>{pesos(v)}</b></div>
            <div className="barrita" aria-hidden="true"><i style={{ transform: `scaleX(${total ? v / total : 0})` }} /></div>
          </div>
        ))}
      </div>

      <div className="esperado">
        <p>Debe haber en caja <strong>{pesos(r.esperado)}</strong></p>
        <p className="nota">Fondo {pesos(r.fondo)} + efectivo cobrado {pesos(r.efectivo)}.{" "}
          {fondoNuevo === null && <button type="button" className="texto" onClick={() => setFondoNuevo(String(r.fondo / 100))}>Cambiar fondo</button>}
        </p>
        {fondoNuevo !== null && (
          <div className="fondo-edit">
            <input className="entrada num" inputMode="decimal" value={fondoNuevo} onChange={(e) => setFondoNuevo(e.target.value)} aria-label="Fondo de caja" />
            <button type="button" className="secundario" onClick={guardarFondo}>Guardar</button>
          </div>
        )}
      </div>

      {r.mas_vendido.length > 0 && (
        <section className="top" aria-labelledby="top-t">
          <h2 id="top-t">Lo que más salió</h2>
          <ol>{r.mas_vendido.map((p) => <li key={p.nombre}><span>{p.nombre}</span><b>{p.cantidad}</b></li>)}</ol>
        </section>
      )}

      {!contando ? (
        <button type="button" className="primario ancho" onClick={() => setContando(true)}>Hacer corte</button>
      ) : (
        <form className="form-corte entra" onSubmit={cerrar}>
          <label className="campo"><span>¿Cuánto efectivo hay en caja?</span>
            <input className="entrada num" inputMode="decimal" value={contado} onChange={(e) => setContado(e.target.value)} placeholder={String(r.esperado / 100)} />
          </label>
          {diferencia !== null && (
            <p className={"diferencia " + (diferencia === 0 ? "cuadra" : diferencia > 0 ? "sobra" : "falta")} aria-live="polite">
              {diferencia === 0 ? "Cuadra exacto" : diferencia > 0 ? <>Sobran <strong>{pesos(diferencia)}</strong></> : <>Faltan <strong>{pesos(-diferencia)}</strong></>}
            </p>
          )}
          <label className="campo"><span>Notas (opcional)</span>
            <input className="entrada" value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Ej. se pagó el gas con caja" />
          </label>
          {r.abiertas > 0 && <p className="nota">Quedan {r.abiertas} {r.abiertas === 1 ? "mesa abierta" : "mesas abiertas"}; lo que cobres después entra en la siguiente caja.</p>}
          <div className="editor-acc">
            <button className="primario" type="submit" disabled={contadoC === null || cerrando}>{cerrando ? "Cerrando…" : "Cerrar caja"}</button>
            <button className="secundario" type="button" onClick={() => setContando(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Corte de caja como ticket, para imprimir o guardar. */
function HojaCorte({ r, onListo }: { r: ResumenTurno; onListo: () => void }) {
  const { actual } = useSesion();
  const dif = r.contado !== null ? r.contado - r.esperado : null;
  const filas: [string, string, boolean?][] = [
    ["Abrió", `${hora(r.abierto_en)}${r.abierto_por ? " · " + r.abierto_por : ""}`],
    ["Cerró", r.cerrado_en ? `${hora(r.cerrado_en)}${r.cerrado_por ? " · " + r.cerrado_por : ""}` : "—"],
    ["Cuentas", String(r.cuentas)],
    ["Ventas", pesos(r.ventas), true],
    ["Propinas", pesos(r.propinas)],
    ["Efectivo", pesos(r.efectivo)],
    ["Tarjeta", pesos(r.tarjeta)],
    ["Transferencia", pesos(r.transferencia)],
    ["Fondo", pesos(r.fondo)],
    ["Debía haber", pesos(r.esperado), true],
    ["Contado", r.contado !== null ? pesos(r.contado) : "—", true],
  ];
  return (
    <div className="caja">
      <button type="button" className="vuelta" onClick={onListo}><Icono n="atras" tam={20} />Caja</button>
      <div className="encabezado">
        <h1 className="titulo" tabIndex={-1}>Corte de caja</h1>
        {dif !== null && <p className={"diferencia " + (dif === 0 ? "cuadra" : dif > 0 ? "sobra" : "falta")}>{dif === 0 ? "Cuadró exacto" : dif > 0 ? <>Sobraron <strong>{pesos(dif)}</strong></> : <>Faltaron <strong>{pesos(-dif)}</strong></>}</p>}
      </div>
      <div className="cobro-ticket">
        <Ticket restaurante={actual} titulo="Corte de caja" subtitulo={dia(r.abierto_en)} filas={filas}
          pie={<>
            {dif !== null && <div className="tk-fila fuerte"><span>Diferencia</span><span>{dif >= 0 ? "+" : "−"}{pesos(Math.abs(dif))}</span></div>}
            {r.mas_vendido.length > 0 && <><p className="tk-sub">Lo que más salió</p>{r.mas_vendido.map((p) => <div key={p.nombre} className="tk-linea"><span>{p.cantidad}</span><span>{p.nombre}</span><span>{pesos(p.importe)}</span></div>)}</>}
            {r.notas && <p>{r.notas}</p>}
          </>}
          cuando={new Date(r.cerrado_en ?? Date.now())} />
      </div>
      <div className="cobro-acc">
        <button type="button" className="secundario" onClick={imprimir}><Icono n="imprimir" tam={20} />Imprimir corte</button>
        <button type="button" className="primario" onClick={onListo}>Listo</button>
      </div>
    </div>
  );
}
