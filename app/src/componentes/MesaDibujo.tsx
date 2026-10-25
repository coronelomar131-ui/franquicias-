import type { Forma } from "../lib/tipos";

/** Posición de cada silla [x, y, giro], en sentido de las manecillas. */
function sillas(forma: Forma, lugares: number): [number, number, number][] {
  if (forma === "larga") {
    const porLado = Math.max(1, Math.ceil((lugares - 2) / 2));
    const arriba: [number, number, number][] = [], abajo: [number, number, number][] = [];
    for (let i = 0; i < porLado; i++) {
      const x = 31 + ((i + 0.5) * 138) / porLado;
      arriba.push([x, 18, 0]); abajo.unshift([x, 102, 180]);
    }
    const todas = [...arriba, [184, 60, 90] as [number, number, number], ...abajo, [16, 60, 270] as [number, number, number]];
    return todas.slice(0, Math.max(lugares, 2));
  }
  const r = forma === "redonda" ? (lugares <= 2 ? 24 : 30) : 29;
  const dist = r + 12;
  return Array.from({ length: lugares }, (_, i) => {
    const a = (i / lugares) * Math.PI * 2 - Math.PI / 2;
    return [60 + Math.cos(a) * dist, 60 + Math.sin(a) * dist, (a * 180) / Math.PI + 90] as [number, number, number];
  });
}

/**
 * Mesa vista desde arriba. Las sillas ocupadas se llenan y aparece el comensal
 * (una cabeza) detrás de cada una. `activa` resalta la silla del comensal elegido.
 */
export function MesaDibujo({ forma, lugares, ocupadas = 0, activa = 0, conNumeros = false }: { forma: Forma; lugares: number; ocupadas?: number; activa?: number; conNumeros?: boolean }) {
  const larga = forma === "larga";
  const cx = larga ? 100 : 60, cy = 60;
  const lista = sillas(forma, larga ? Math.max(lugares, 2) : lugares);
  const vb = larga ? "-14 -14 228 148" : "-14 -14 148 148";
  const r = forma === "redonda" ? (lugares <= 2 ? 24 : 30) : 29;
  return (
    <svg viewBox={vb} aria-hidden="true" focusable="false" className="mesa-svg">
      {lista.map(([x, y, giro], i) => {
        const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1;
        const hx = x + (dx / d) * 11, hy = y + (dy / d) * 11;
        const ocupada = i < ocupadas;
        return (
          <g key={i} className={"silla" + (ocupada ? " ocupada" : "") + (activa === i + 1 ? " activa" : "")} style={{ ["--i" as string]: i }}>
            <circle className="cabeza" cx={hx} cy={hy} r={6.2} />
            <g transform={`translate(${x} ${y}) rotate(${giro})`}>
              <rect className="s-v" x={-12} y={-5.5} width={24} height={11} rx={4} />
              <rect className="s-l" x={-12} y={-5.5} width={24} height={11} rx={4} />
            </g>
            {conNumeros && <text x={x} y={y}>{i + 1}</text>}
          </g>
        );
      })}
      {forma === "cuadrada" && <rect className="cubierta" x={31} y={31} width={58} height={58} rx={5} />}
      {forma === "redonda" && <circle className="cubierta" cx={60} cy={60} r={r} />}
      {larga && <rect className="cubierta" x={31} y={33} width={138} height={54} rx={5} />}
    </svg>
  );
}
