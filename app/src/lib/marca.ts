import type { ColorMarca, Fondo, Tipografia } from "./tipos";
import { aHex, contraste, deHex, esHex, papelDe } from "./color";

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

export interface Marca {
  color_marca?: ColorMarca; tipografia?: Tipografia; fondo?: Fondo;
  color_principal?: string | null; color_secundario?: string | null; color_fondo?: string | null;
}

export function hexFondo(f: Fondo | undefined, libre?: string | null) {
  if (esHex(libre)) return papelDe(libre);
  return (FONDOS.find((x) => x.id === f) ?? FONDOS[0]).hex;
}

const legado = (id: ColorMarca | undefined) => {
  const c = COLORES.find((x) => x.id === id) ?? COLORES[0];
  const [l, ch, h] = c.color.replace(/[^0-9. ]/g, "").trim().split(/\s+/).map(Number);
  return aHex({ l, c: ch, h });
};
/** Color principal en hex: el libre si lo hay, si no el de la paleta original. */
export const principalDe = (m: Marca | null | undefined) => (esHex(m?.color_principal) ? m!.color_principal! : legado(m?.color_marca));

const TINTA = "#2b231c";
const CLARO = "#fffcf6";

/** Variables de marca. Va en una hoja aparte (no en style del html) para que el tema de cocina pueda ganarle. */
function hojaDeMarca(m: Marca | null | undefined): string {
  const principal = principalDe(m);
  const o = deHex(principal);
  const papel = hexFondo(m?.fondo, m?.color_fondo);
  // Texto encima del botón: claro u oscuro, el que se lea mejor
  const sobre = contraste(principal, CLARO) >= contraste(principal, TINTA) ? CLARO : TINTA;
  // Para letras y bordes sobre el papel, oscurece el color hasta que se lea (4.5:1)
  let tinta = principal, l = o.l;
  while (contraste(tinta, papel) < 4.5 && l > 0.15) { l -= 0.02; tinta = aHex({ ...o, l }); }
  const claroCocina = aHex({ l: Math.max(o.l, 0.74), c: Math.min(o.c, 0.14), h: o.h });
  const hover = aHex({ ...o, l: o.l > 0.6 ? o.l - 0.06 : o.l - 0.04 });
  const sec = esHex(m?.color_secundario) ? deHex(m!.color_secundario!) : null;
  const ocupada = sec ? aHex({ l: 0.86, c: Math.min(sec.c, 0.13), h: sec.h }) : null;
  const secFuerte = sec ? aHex({ l: Math.min(sec.l, 0.55), c: sec.c, h: sec.h }) : null;
  const fondo = esHex(m?.color_fondo) ? `--papel: ${papel}; --papel-2: ${papelDe(m!.color_fondo!, 0.935)}; --papel-3: ${papelDe(m!.color_fondo!, 0.9)}; --ticket: ${papelDe(m!.color_fondo!, 0.988)}; --e-libre: ${papelDe(m!.color_fondo!, 0.975)};` : "";
  return `:root { --acento: ${principal}; --acento-hover: ${hover}; --sobre-acento: ${sobre}; --acento-suave: ${principal}1f; --acento-tinta: ${tinta};${ocupada ? ` --e-ocupada: ${ocupada}; --secundario: ${secFuerte};` : ""} }
html:not([data-tema="cocina"]) { ${fondo} }
html[data-tema="cocina"] { --acento-tinta: ${claroCocina}; }`;
}

export function aplicarMarca(m: Marca | null | undefined) {
  const t = TIPOGRAFIAS.find((x) => x.id === m?.tipografia) ?? TIPOGRAFIAS[0];
  const raiz = document.documentElement;
  let hoja = document.getElementById("marca") as HTMLStyleElement | null;
  if (!hoja) { hoja = document.createElement("style"); hoja.id = "marca"; document.head.appendChild(hoja); }
  hoja.textContent = hojaDeMarca(m);
  // Fondo de paleta y letra van por atributo: así el tema oscuro de cocina les gana en el CSS
  raiz.dataset.fondo = m?.fondo ?? "crema";
  t.cargar().catch(() => {}).finally(() => { raiz.dataset.letra = t.id; });
  if (raiz.dataset.tema !== "cocina") document.querySelector('meta[name="theme-color"]')?.setAttribute("content", hexFondo(m?.fondo, m?.color_fondo));
}
