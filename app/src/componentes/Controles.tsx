import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icono } from "./Icono";

/** − n + con límites. */
export function Paso({ valor, min, max, onCambio, etiqueta, grande }: { valor: number; min: number; max: number; onCambio: (v: number) => void; etiqueta: string; grande?: boolean }) {
  return (
    <div className={"paso" + (grande ? " grande" : "")} role="group" aria-label={etiqueta}>
      <button type="button" onClick={() => onCambio(Math.max(min, valor - 1))} disabled={valor <= min} aria-label={"Menos " + etiqueta.toLowerCase()}><Icono n="menos" /></button>
      <output aria-live="polite">{valor}</output>
      <button type="button" onClick={() => onCambio(Math.min(max, valor + 1))} disabled={valor >= max} aria-label={"Más " + etiqueta.toLowerCase()}><Icono n="mas" /></button>
    </div>
  );
}

/** Segmento de opciones con lente que se desliza. */
export function Segmento<T extends string>({ opciones, valor, onCambio, etiqueta }: { opciones: { id: T; texto: ReactNode }[]; valor: T; onCambio: (v: T) => void; etiqueta: string }) {
  const i = Math.max(0, opciones.findIndex((o) => o.id === valor));
  return (
    <div className="seg" role="group" aria-label={etiqueta}>
      <span className="lente-s" style={{ width: `calc((100% - 8px) / ${opciones.length})`, transform: `translateX(${i * 100}%)` }} />
      {opciones.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === valor} onClick={() => onCambio(o.id)}>{o.texto}</button>
      ))}
    </div>
  );
}

/** Acciones que borran: piden un segundo toque, sin ventanas encima. */
export function DobleToque({ texto, pregunta, onConfirmar, className = "texto peligro", disabled }: { texto: string; pregunta: string; onConfirmar: () => void; className?: string; disabled?: boolean }) {
  const [armado, setArmado] = useState(false);
  const t = useRef<number>();
  useEffect(() => () => window.clearTimeout(t.current), []);
  return (
    <button type="button" className={className} disabled={disabled} onClick={() => {
      if (armado) { window.clearTimeout(t.current); setArmado(false); onConfirmar(); return; }
      setArmado(true); t.current = window.setTimeout(() => setArmado(false), 3500);
    }}>{armado ? pregunta : texto}</button>
  );
}
