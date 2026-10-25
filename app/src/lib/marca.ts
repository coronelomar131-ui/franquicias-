import type { ColorMarca } from "./tipos";

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

export function aplicarMarca(id: ColorMarca | undefined) {
  const c = COLORES.find((x) => x.id === id) ?? COLORES[0];
  const raiz = document.documentElement.style;
  raiz.setProperty("--acento", c.color);
  raiz.setProperty("--acento-hover", c.hover);
  raiz.setProperty("--acento-suave", c.color.replace(")", " / 0.1)"));
}
