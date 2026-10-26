import type { ReactNode } from "react";
import { pesos } from "../lib/formato";
import type { Restaurante } from "../lib/tipos";

export interface LineaTicket { cantidad: number; nombre: string; importe: number }

const fecha = (d: Date) => d.toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Ticket de papel: el mismo se ve en pantalla y se imprime (80 mm, sirve en impresoras térmicas). */
export function Ticket({ restaurante, titulo, subtitulo, lineas, filas, total, pie, cuando = new Date() }: {
  restaurante: Restaurante | null;
  titulo: string;
  subtitulo?: string;
  lineas?: LineaTicket[];
  /** Renglones etiqueta/valor debajo de los productos (subtotal, propina, pago, cambio…). */
  filas?: [string, string, boolean?][];
  total?: [string, number];
  pie?: ReactNode;
  cuando?: Date;
}) {
  return (
    <div className="ticket-papel imprimible">
      <div className="tk-cab">
        {restaurante?.logo_url && <img src={restaurante.logo_url} alt="" />}
        <b translate="no">{restaurante?.nombre}</b>
        {restaurante?.eslogan && <small>{restaurante.eslogan}</small>}
      </div>
      <div className="tk-titulo"><span>{titulo}</span>{subtitulo && <span>{subtitulo}</span>}</div>
      <div className="tk-fecha">{fecha(cuando)}</div>
      {lineas && lineas.length > 0 && (
        <div className="tk-lineas">
          {lineas.map((l, i) => (
            <div key={i} className="tk-linea"><span>{l.cantidad}</span><span>{l.nombre}</span><span>{pesos(l.importe)}</span></div>
          ))}
        </div>
      )}
      {filas && filas.length > 0 && (
        <div className="tk-filas">
          {filas.map(([a, b, fuerte], i) => <div key={i} className={"tk-fila" + (fuerte ? " fuerte" : "")}><span>{a}</span><span>{b}</span></div>)}
        </div>
      )}
      {total && <div className="tk-total"><span>{total[0]}</span><strong>{pesos(total[1])}</strong></div>}
      {pie && <div className="tk-pie">{pie}</div>}
    </div>
  );
}

/** Imprime solo el ticket: el navegador abre su diálogo y ahí se elige la impresora. */
export function imprimir() {
  document.documentElement.classList.add("imprimiendo");
  const quitar = () => { document.documentElement.classList.remove("imprimiendo"); removeEventListener("afterprint", quitar); };
  addEventListener("afterprint", quitar);
  window.print();
  window.setTimeout(quitar, 60000);
}
