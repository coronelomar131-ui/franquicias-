import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { mensajeError } from "../lib/formato";
import { useAviso } from "../componentes/Aviso";

interface Ticket {
  id: string; ronda: number; enviada_en: string; mesa: string; comensales: number; folio: number;
  renglones: { nombre: string; cantidad: number; comensal: number; nota: string }[];
}
const poco = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const mmss = (iso: string) => { const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); };
const hora = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function Cocina({ rid }: { rid: string }) {
  const avisar = useAviso();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [saliendo, setSaliendo] = useState<Set<string>>(new Set());
  const [, setTic] = useState(0);
  const vistos = useRef<Set<string> | null>(null);
  const riel = useRef<HTMLUListElement>(null);

  const cargar = useCallback(async () => {
    const { data: cs, error } = await supabase.from("comandas")
      .select("id, ronda, enviada_en, ordenes(folio, comensales, mesas(nombre))")
      .eq("restaurante_id", rid).eq("estado", "pendiente").order("enviada_en");
    if (error) throw error;
    const ids = (cs ?? []).map((c) => c.id);
    const { data: rs, error: e2 } = ids.length
      ? await supabase.from("renglones").select("comanda_id, nombre, cantidad, comensal, nota").in("comanda_id", ids).eq("cancelado", false).order("comensal")
      : { data: [], error: null };
    if (e2) throw e2;
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
    return () => { supabase.removeChannel(canal); window.clearInterval(reloj); };
  }, [rid, cargar, avisar]);

  // La primera carga cuelga todo de una vez; después solo se anima lo que llega nuevo
  const nuevos = new Set<string>();
  if (tickets) {
    if (vistos.current === null) { vistos.current = new Set(); tickets.forEach((t) => nuevos.add(t.id)); }
    else tickets.forEach((t) => { if (!vistos.current!.has(t.id)) nuevos.add(t.id); });
  }
  useEffect(() => { tickets?.forEach((t) => vistos.current?.add(t.id)); }, [tickets]);

  async function lista(t: Ticket) {
    if (saliendo.has(t.id)) return;
    setSaliendo((s) => new Set(s).add(t.id));
    const { error } = await supabase.from("comandas").update({ estado: "lista", lista_en: new Date().toISOString() }).eq("id", t.id);
    if (error) { avisar(mensajeError(error), "error"); setSaliendo((s) => { const n = new Set(s); n.delete(t.id); return n; }); return; }
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
      </div>
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
                <button type="button" className="lista" disabled={fuera} onClick={() => lista(t)} aria-label={`Marcar lista la comanda de la mesa ${t.mesa}, ronda ${t.ronda}`}>Lista</button>
              </li>
            );
          })}
        </ul>
        {tickets !== null && n === 0 && (
          <div className="k-vacio"><strong>El pase está vacío</strong>Cuando una mesa mande su pedido, la comanda aparece colgada aquí, con su tiempo corriendo.</div>
        )}
      </div>
    </div>
  );
}
