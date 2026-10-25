import type { ColorMarca, Fondo, Tipografia } from "./tipos";

/** Colores de marca probados con texto claro encima (contraste AA) y sobre el papel. */
export const COLORES: { id: ColorMarca; nombre: string; color: string; hover: string }[] = [
  { id: "achiote", nombre: "Achiote", color: "oklch(0.48 0.14 36)", hover: "oklch(0.44 0.14 36)" },
  { id: "vino", nombre: "Vino", color: "oklch(0.42 0.13 15)", hover: "oklch(0.38 0.13 15)" },
  { id: "rosa", nombre: "Rosa mexicano", color: "oklch(0.47 0.18 0)", hover: "oklch(0.43 0.18 0)" },
  { id: "mostaza", nombre: "Mostaza", color: "oklch(0.46 0.1 70)", hover: "oklch(0.42 0.1 70)" },
  { id: "nopal", nombre: "Nopal", color: "oklch(0.45 0.1 150)", hover: "oklch(0.41 0.1 150)" },
  { id: "talavera", nombre: "Talavera", color: "oklch(0.42 0.12 255)", hover: "oklch(0.38 0.12 255)" },
  { id: "tinta", nombre: "Tinta", color: "oklch(0.28 0.02 60)", hover: "oklch(0.24 0.02 60)" },
];

/** Letra de títulos, botones y tickets. El cuerpo siempre es Barlow para que se lea igual. */
export const TIPOGRAFIAS: { id: Tipografia; nombre: string; para: string; familia: string; cargar: () => Promise<unknown> }[] = [
  { id: "fonda", nombre: "Fonda", para: "Letrero de mercado", familia: '"Saira Condensed"', cargar: async () => {} },
  { id: "cantina", nombre: "Cantina", para: "Rótulo pintado a mano", familia: '"Big Shoulders Display Variable"', cargar: () => import("@fontsource-variable/big-shoulders-display") },
  { id: "bistro", nombre: "Bistró", para: "Carta de mantel largo", familia: '"Fraunces Variable"', cargar: () => import("@fontsource-variable/fraunces") },
  { id: "moderna", nombre: "Moderna", para: "Café de barrio", familia: '"Bricolage Grotesque Variable"', cargar: () => import("@fontsource-variable/bricolage-grotesque") },
];

/** Tonos de papel. El hex va a la barra del navegador en el teléfono. */
export const FONDOS: { id: Fondo; nombre: string; muestra: string; hex: string }[] = [
  { id: "crema", nombre: "Mantel", muestra: "oklch(0.965 0.012 85)", hex: "#f4efe6" },
  { id: "blanco", nombre: "Mármol", muestra: "oklch(0.985 0.003 90)", hex: "#fbfaf8" },
  { id: "arena", nombre: "Barro", muestra: "oklch(0.94 0.022 75)", hex: "#efe5d4" },
  { id: "salvia", nombre: "Hierbabuena", muestra: "oklch(0.955 0.014 150)", hex: "#ebf1ea" },
];

export interface Marca { color_marca?: ColorMarca; tipografia?: Tipografia; fondo?: Fondo }

export function hexFondo(f: Fondo | undefined) { return (FONDOS.find((x) => x.id === f) ?? FONDOS[0]).hex; }

export function aplicarMarca(m: Marca | null | undefined) {
  const c = COLORES.find((x) => x.id === m?.color_marca) ?? COLORES[0];
  const t = TIPOGRAFIAS.find((x) => x.id === m?.tipografia) ?? TIPOGRAFIAS[0];
  const raiz = document.documentElement;
  raiz.style.setProperty("--acento", c.color);
  raiz.style.setProperty("--acento-hover", c.hover);
  raiz.style.setProperty("--acento-suave", c.color.replace(")", " / 0.1)"));
  // Fondo y letra van por atributo: así el tema oscuro de cocina les gana en el CSS
  raiz.dataset.fondo = m?.fondo ?? "crema";
  t.cargar().catch(() => {}).finally(() => { raiz.dataset.letra = t.id; });
  if (raiz.dataset.tema !== "cocina") document.querySelector('meta[name="theme-color"]')?.setAttribute("content", hexFondo(m?.fondo));
}
