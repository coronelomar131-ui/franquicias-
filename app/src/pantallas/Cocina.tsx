import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { conRecuerdo } from "../lib/recuerdo";
import { guardar } from "../lib/cola";
import { escpos, guardarConfig, imprimirRawBT, leerConfig, marcarImpresas, yaImpresas, type ConfigImpresion } from "../lib/impresion";
import { mensajeError } from "../lib/formato";
import { useSesion } from "../estado/sesion";
import { useAviso } from "../componentes/Aviso";
import { Segmento } from "../componentes/Controles";
import { Icono } from "../componentes/Icono";
import { imprimir } from "../componentes/Ticket";

interface Ticket {
  id: string; ronda: number; enviada_en: string; mesa: string; comensales: number; folio: number;
  renglones: { nombre: string; cantidad: number; comensal: number; nota: string }[];
}
const poco = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const mmss = (iso: string) => { const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
const hora = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function Cocina({ rid }: { rid: string }) {
  const avisar = useAviso();
  const { actual } = useSesion();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [config, setConfig] = useState<ConfigImpresion>(leerConfig);
  const [panel, setPanel] = useState(false);
  const [aImprimir, setAImprimir] = useState<Ticket | null>(null);
  const colaImpresion = useRef<Ticket[]>([]);
  const [saliendo, setSaliendo] = useState<Set<string>>(new Set());
  const [, setTic] = useState(0);
  const vistos = useRef<Set<string> | null>(null);
  const riel = useRef<HTMLUListElement>(null);

  const cargar = useCallback(async () => {
    type Linea = { comanda_id: string; nombre: string; cantidad: number; comensal: number; nota: string };
    const cs = await conRecuerdo<{ id: string }[]>("cocina:" + rid, () => supabase.from("comandas")
      .select("id, ronda, enviada_en, ordenes(folio, comensales, mesas(nombre))")
      .eq("restaurante_id", rid).eq("estado", "pendiente").order("enviada_en"));
    const ids = (cs ?? []).map((c) => c.id);
    const rs = ids.length
      ? await conRecuerdo<Linea[]>("cocina-renglones:" + rid, () => supabase.from("renglones").select("comanda_id, nombre, cantidad, comensal, nota").in("comanda_id", ids).eq("cancelado", false).order("comensal"))
      : [];
    type Fila = { id: string; ronda: number; enviada_en: string; ordenes: { folio: number; comensales: number; mesas: { nombre: string } | null } | null };
    setTickets(((cs ?? []) as unknown as Fila[]).map((c) => ({
      id: c.id, ronda: c.ronda, enviada_en: c.enviada_en,
      mesa: c.ordenes?.mesas?.nombre ?? "—", comensales: c.ordenes?.comensales ?? 1, folio: c.ordenes?.folio ?? 0,
      renglones: (rs ?? []).filter((r) => r.comanda_id === c.id),
    })));
  }, [rid]);

  useEffect(() => {
    cargar().catch((e) => { setTickets([]); avisar(mensajeError(e), "error"); });
    const canal = supabase.channel("cocina-" + rid)
      .on("postgres_changes", { event: "*", schema: "public", table: "comandas", filter: "restaurante_id=eq." + rid }, () => { cargar().catch(() => {}); })
      .subscribe();
    const reloj = window.setInterval(() => setTic((t) => t + 1), 1000);
    // Red de seguridad: si el tiempo real se cae sin avisar, igual llegan las comandas (y se imprimen)
    const repaso = window.setInterval(() => { cargar().catch(() => {}); }, 20000);
    return () => { supabase.removeChannel(canal); window.clearInterval(reloj); window.clearInterval(repaso); };
  }, [rid, cargar, avisar]);

  // La primera carga cuelga todo de una vez; después solo se anima lo que llega nuevo
  const nuevos = new Set<string>();
  if (tickets) {
    if (vistos.current === null) { vistos.current = new Set(); tickets.forEach((t) => nuevos.add(t.id)); }
    else tickets.forEach((t) => { if (!vistos.current!.has(t.id)) nuevos.add(t.id); });
  }
  useEffect(() => { tickets?.forEach((t) => vistos.current?.add(t.id)); }, [tickets]);

  // ── Impresión ──
  const imprimirUna = useCallback((t: Ticket) => {
    if (config.modo === "rawbt") {
      imprimirRawBT(escpos({ ...t, restaurante: actual?.nombre ?? "" }, config.ancho));
      return;
    }
    // En modo sistema se pinta la comanda escondida y se abre la impresión del aparato
    setAImprimir(t);
  }, [config, actual?.nombre]);
  useEffect(() => {
    if (!aImprimir) return;
    const r = requestAnimationFrame(() => {
      imprimir();
      // Si llegaron varias juntas, salen una tras otra
      window.setTimeout(() => { const sig = colaImpresion.current.shift(); setAImprimir(sig ?? null); }, 1200);
    });
    return () => cancelAnimationFrame(r);
  }, [aImprimir]);
  useEffect(() => {
    if (!tickets || !config.auto) return;
    const hechas = yaImpresas();
    const nuevas = tickets.filter((t) => !hechas.has(t.id));
    if (!nuevas.length) return;
    marcarImpresas(nuevas.map((t) => t.id));
    if (config.modo === "rawbt") { nuevas.forEach((t, i) => window.setTimeout(() => imprimirUna(t), i * 1500)); return; }
    const [primera, ...resto] = nuevas;
    colaImpresion.current.push(...resto);
    if (!aImprimir) setAImprimir(primera); else colaImpresion.current.unshift(primera);
  }, [tickets, config.auto, config.modo, imprimirUna]); // eslint-disable-line react-hooks/exhaustive-deps
  function cambiarConfig(c: ConfigImpresion) {
    // Al prender la impresión automática, lo que ya está colgado no se vuelve a imprimir
    if (c.auto && !config.auto && tickets) marcarImpresas(tickets.map((t) => t.id));
    setConfig(c); guardarConfig(c);
  }
  const prueba: Ticket = { id: "prueba", ronda: 1, enviada_en: new Date().toISOString(), mesa: "Prueba", comensales: 1, folio: 0, renglones: [{ nombre: "Comanda de prueba", cantidad: 1, comensal: 1, nota: "Si sale bien, ya quedó" }] };

  async function lista(t: Ticket) {
    if (saliendo.has(t.id)) return;
    setSaliendo((s) => new Set(s).add(t.id));
    const res = await guardar({ tipo: "cambiar", tabla: "comandas", filaId: t.id, cambios: { estado: "lista", lista_en: new Date().toISOString() } }, { texto: `Comanda de la mesa ${t.mesa} lista` });
    if (!res.ok) { avisar(mensajeError({ message: res.error }), "error"); setSaliendo((s) => { const n = new Set(s); n.delete(t.id); return n; }); return; }
    // Deja ver el sello y luego la comanda sale; las demás se recorren a su lugar
    window.setTimeout(() => {
      const hermanos = [...(riel.current?.children ?? [])].filter((x) => (x as HTMLElement).dataset.id !== t.id) as HTMLElement[];
      const antes = new Map(hermanos.map((h) => [h, h.getBoundingClientRect().left]));
      setTickets((ts) => ts?.filter((x) => x.id !== t.id) ?? ts);
      requestAnimationFrame(() => {
        if (poco()) return;
        hermanos.forEach((h) => {
          const dx = (antes.get(h) ?? 0) - h.getBoundingClientRect().left;
          if (dx) h.animate([{ transform: `translateX(${dx}px)` }, { transform: "translateX(0px)" }], { duration: 260, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });
        });
      });
      avisar(`Mesa ${t.mesa}: a servir`);
    }, poco() ? 200 : 700);
  }

  const n = tickets?.length ?? 0;
  return (
    <div className="cocina">
      <div className="encabezado">
        <h1 className="titulo" tabIndex={-1}>Cocina</h1>
        <p className="sub">{tickets === null ? "Cargando comandas…" : n ? <><b>{n}</b> {n === 1 ? "comanda en el pase" : "comandas en el pase"}</> : "Sin pendientes"}</p>
        <button type="button" className={"impresora-b" + (config.auto ? " activa" : "")} aria-expanded={panel} onClick={() => setPanel((v) => !v)}>
          <Icono n="imprimir" tam={18} />{config.auto ? "Imprime solo" : "Impresora"}
        </button>
      </div>
      {panel && (
        <div className="panel-imp entra">
          <label className="interruptor">
            <input type="checkbox" checked={config.auto} onChange={(e) => cambiarConfig({ ...config, auto: e.target.checked })} />
            <span className="riel" aria-hidden="true"><i /></span>
            <span>Imprimir cada comanda nueva</span>
          </label>
          <div className="campo"><span>Cómo imprime este aparato</span>
            <Segmento etiqueta="Cómo imprime" valor={config.modo} onCambio={(m) => cambiarConfig({ ...config, modo: m })}
              opciones={[{ id: "sistema", texto: "Impresora del aparato" }, { id: "rawbt", texto: "Bluetooth (RawBT)" }]} />
          </div>
          <div className="campo"><span>Papel</span>
            <Segmento etiqueta="Papel" valor={String(config.ancho) as "58" | "80"} onCambio={(a) => cambiarConfig({ ...config, ancho: Number(a) as 58 | 80 })}
              opciones={[{ id: "58", texto: "58 mm" }, { id: "80", texto: "80 mm" }]} />
          </div>
          <p className="nota">{config.modo === "rawbt"
            ? "Para tabletas Android con impresora de tickets Bluetooth: instala la app gratuita RawBT, conéctala a la impresora una vez y las comandas salen solas."
            : "Usa la impresora que tenga conectada este aparato. En una compu con Chrome se puede dejar sin la ventana de imprimir; en tableta pedirá confirmar cada vez."}</p>
          <button type="button" className="secundario" onClick={() => imprimirUna(prueba)}>Imprimir prueba</button>
        </div>
      )}
      <div className="pase-k">
        <div className="riel-k" aria-hidden="true" />
        <ul ref={riel} className="colgadas" aria-label="Comandas en el pase">
          {(tickets ?? []).map((t, i) => {
            const prep = new Map<string, number>();
            t.renglones.forEach((r) => prep.set(r.nombre, (prep.get(r.nombre) ?? 0) + r.cantidad));
            const ms = Date.now() - new Date(t.enviada_en).getTime();
            const fuera = saliendo.has(t.id);
            return (
              <li key={t.id} data-id={t.id} className={"comanda-k" + (nuevos.has(t.id) ? " cuelga" : "") + (fuera ? " sale" : "")} style={{ animationDelay: nuevos.has(t.id) ? `${Math.min(i, 6) * 70}ms` : undefined }}>
                <span className="pinza" aria-hidden="true" />
                <div className="papel">
                  <div className="t-cab"><b>Mesa {t.mesa}</b><span>Ronda {t.ronda}</span></div>
                  <div className="t-meta"><span>{hora.format(new Date(t.enviada_en))} · Folio {t.folio}</span><span className="t-timer" data-nivel={ms > 20 * 60000 ? 2 : ms > 10 * 60000 ? 1 : 0}>{mmss(t.enviada_en)}</span></div>
                  {Array.from({ length: t.comensales }, (_, k) => k + 1).map((c) => {
                    const ls = t.renglones.filter((r) => r.comensal === c);
                    if (!ls.length) return null;
                    return (
                      <div key={c} className="t-grupo"><h4>Comensal {c}</h4>
                        {ls.map((r, j) => <div key={j} className="t-linea"><span className="t-c">{r.cantidad}×</span><span>{r.nombre}{r.nota && <em> · {r.nota}</em>}</span></div>)}
                      </div>
                    );
                  })}
                  <div className="t-prep"><h4>Prepara</h4>
                    {[...prep].map(([nom, c]) => <div key={nom} className="t-linea"><span className="t-c">{c}</span><span>{nom}</span></div>)}
                  </div>
                </div>
                {fuera && <span className="sello-k" aria-hidden="true">Lista</span>}
                <div className="acc-k">
                  <button type="button" className="lista" disabled={fuera} onClick={() => lista(t)} aria-label={`Marcar lista la comanda de la mesa ${t.mesa}, ronda ${t.ronda}`}>Lista</button>
                  <button type="button" className="imp-k" onClick={() => imprimirUna(t)} aria-label={`Imprimir la comanda de la mesa ${t.mesa}`}><Icono n="imprimir" tam={20} /></button>
                </div>
              </li>
            );
          })}
        </ul>
        {aImprimir && (
          <div className="solo-imprimir imprimible comanda-imp">
            <b>{actual?.nombre}</b>
            <strong>Mesa {aImprimir.mesa}</strong>
            <span>Ronda {aImprimir.ronda} · {hora.format(new Date(aImprimir.enviada_en))} · Folio {aImprimir.folio || "—"}</span>
            {[...new Set(aImprimir.renglones.map((r) => r.comensal))].sort((a, b) => a - b).map((c) => (
              <div key={c}><h4>Comensal {c}</h4>{aImprimir.renglones.filter((r) => r.comensal === c).map((r, j) => <p key={j}><b>{r.cantidad}×</b> {r.nombre}{r.nota && <em> — {r.nota}</em>}</p>)}</div>
            ))}
          </div>
        )}
        {tickets !== null && n === 0 && (
          <div className="k-vacio"><strong>El pase está vacío</strong>Cuando una mesa mande su pedido, la comanda aparece colgada aquí, con su tiempo corriendo.</div>
        )}
      </div>
    </div>
  );
}
