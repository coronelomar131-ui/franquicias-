import { useId, useState } from "react";
import { FAMILIAS, TONOS, colorDe, papelDe, type Tono } from "../lib/color";
import { Segmento } from "./Controles";
import { Icono } from "./Icono";

/** Busca en qué tono de la paleta cae un color, para abrir el selector ahí. */
function tonoDe(hex: string | null): Tono {
  if (!hex) return "vivo";
  for (const t of TONOS) if (FAMILIAS.some((f) => colorDe(f.id, t.id) === hex)) return t.id;
  return "vivo";
}

export function SelectorColor({ etiqueta, valor, onCambio, ninguno, papel }: {
  etiqueta: string;
  valor: string | null;
  onCambio: (hex: string | null) => void;
  /** Texto de la opción "sin color propio", si se permite. */
  ninguno?: string;
  /** Para el fondo: cada familia se muestra como papel claro de ese color. */
  papel?: boolean;
}) {
  const [tono, setTono] = useState<Tono>(() => tonoDe(valor));
  const id = useId();
  const opciones = FAMILIAS.map((f) => {
    const base = colorDe(f.id, papel ? "vivo" : tono);
    return { id: f.id, nombre: f.nombre, hex: papel ? papelDe(base) : base, guarda: base };
  });
  const enPaleta = opciones.some((o) => o.guarda === valor);
  const libre = valor && !enPaleta ? valor : null;

  return (
    <fieldset className="campo colores">
      <legend>{etiqueta}</legend>
      {!papel && <div className="tonos"><Segmento etiqueta={`Tono de ${etiqueta.toLowerCase()}`} valor={tono} onCambio={setTono} opciones={TONOS.map((t) => ({ id: t.id, texto: t.nombre }))} /></div>}
      <div className="paleta" role="radiogroup" aria-label={etiqueta}>
        {ninguno && (
          <button type="button" role="radio" aria-checked={valor === null} className="gota ninguno" onClick={() => onCambio(null)}>
            <i aria-hidden="true">{valor === null && <Icono n="ok" tam={16} />}</i><span>{ninguno}</span>
          </button>
        )}
        {opciones.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={o.guarda === valor} className="gota" onClick={() => onCambio(o.guarda)} style={{ ["--c" as string]: o.hex }}>
            <i aria-hidden="true">{o.guarda === valor && <Icono n="ok" tam={16} />}</i><span>{o.nombre}</span>
          </button>
        ))}
        <label className={"gota otro" + (libre ? " elegido" : "")} htmlFor={id} style={libre ? { ["--c" as string]: papel ? papelDe(libre) : libre } : undefined}>
          <i aria-hidden="true">{libre && <Icono n="ok" tam={16} />}</i><span>Otro color</span>
          <input id={id} type="color" className="sr-only" value={valor ?? "#a0522d"} onChange={(e) => onCambio(e.target.value.toLowerCase())} aria-label={`${etiqueta}: cualquier color`} />
        </label>
      </div>
    </fieldset>
  );
}
