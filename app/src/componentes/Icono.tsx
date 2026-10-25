const TRAZOS = {
  atras: "M15 18l-6-6 6-6",
  mas: "M12 5v14M5 12h14",
  menos: "M5 12h14",
  ok: "M5 12.5l4.5 4.5L19 7.5",
  lapiz: "M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4",
  arriba: "M12 19V5M6 11l6-6 6 6",
  abajo: "M12 5v14M6 13l6 6 6-6",
  salir: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  salon: "M3 9h18M3 15h18M9 3v18M15 3v18",
  menu: "M5 6h14M5 12h14M5 18h9",
  mesa: "M4 8h16M6 8v10M18 8v10M9 4h6",
  equipo: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c0-3 3-5 6-5s6 2 6 5M16 11a3 3 0 1 0 0-6M18 15c2 .5 4 2 4 5",
  cerrar: "M6 6l12 12M18 6L6 18",
} as const;
export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ n, tam }: { n: NombreIcono; tam?: number }) {
  return (
    <span className="ico" aria-hidden="true">
      <svg viewBox="0 0 24 24" style={tam ? { width: tam, height: tam } : undefined}><path d={TRAZOS[n]} /></svg>
    </span>
  );
}
