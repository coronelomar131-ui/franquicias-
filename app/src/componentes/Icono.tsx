const TRAZOS = {
  atras: "M15 18l-6-6 6-6",
  adelante: "M9 6l6 6-6 6",
  tienda: "M4 10l1.5-5h13L20 10M4 10h16M5 10v10h14V10M10 20v-5h4v5",
  candado: "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5zM12 15v2",
  caja: "M4 10h16v10H4zM7 10V5h10v5M8 14h2M14 14h2M8 17h8",
  imprimir: "M7 9V4h10v5M6 18H4v-7h16v7h-2M7 14h10v6H7z",
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
  cocina: "M6 13h12v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6zM4 13h16M9 9c0-2 1-2 1-4M13 9c0-2 1-2 1-4",
  ajustes: "M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6",
  foto: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  enviar: "M4 12l16-8-6 16-3-7-7-1z",
} as const;
export type NombreIcono = keyof typeof TRAZOS;

export function Icono({ n, tam }: { n: NombreIcono; tam?: number }) {
  return (
    <span className="ico" aria-hidden="true">
      <svg viewBox="0 0 24 24" style={tam ? { width: tam, height: tam } : undefined}><path d={TRAZOS[n]} /></svg>
    </span>
  );
}
