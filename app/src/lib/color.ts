/** Colores en OKLCH: el tono se mueve sin que cambie qué tan claro se ve, así los tonos de cada familia quedan parejos. */
export interface Oklch { l: number; c: number; h: number }

const lineal = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const gamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

function aRgbLineal({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180), b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}
const cabe = (rgb: number[]) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);

/** OKLCH a hex. Si el color no existe en pantalla, baja la saturación hasta que quepa (mismo tono y luz). */
export function aHex(o: Oklch): string {
  let c = o.c, rgb = aRgbLineal(o);
  while (!cabe(rgb) && c > 0) { c = Math.max(0, c - 0.004); rgb = aRgbLineal({ ...o, c }); }
  return "#" + rgb.map((v) => Math.round(Math.min(1, Math.max(0, gamma(v))) * 255).toString(16).padStart(2, "0")).join("");
}

export function deHex(hex: string): Oklch {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => lineal(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

/** Luminancia relativa (WCAG) para decidir contraste. */
export function luminancia(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => lineal(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contraste(a: string, b: string) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export const esHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/.test(v);

// ── Familias y tonos ─────────────────────────────────────────────
export type Tono = "vivo" | "mate" | "pastel" | "oscuro";
export const TONOS: { id: Tono; nombre: string }[] = [
  { id: "vivo", nombre: "Vivo" },
  { id: "mate", nombre: "Mate" },
  { id: "pastel", nombre: "Pastel" },
  { id: "oscuro", nombre: "Oscuro" },
];
/** c es cuánto color admite la familia: el café y el gris casi no llevan. */
export const FAMILIAS: { id: string; nombre: string; h: number; c: number }[] = [
  { id: "rojo", nombre: "Rojo", h: 27, c: 1 },
  { id: "jitomate", nombre: "Jitomate", h: 38, c: 1 },
  { id: "naranja", nombre: "Naranja", h: 55, c: 1 },
  { id: "mostaza", nombre: "Mostaza", h: 80, c: 0.85 },
  { id: "amarillo", nombre: "Amarillo", h: 97, c: 0.9 },
  { id: "lima", nombre: "Lima", h: 125, c: 0.9 },
  { id: "verde", nombre: "Verde", h: 148, c: 0.9 },
  { id: "esmeralda", nombre: "Esmeralda", h: 165, c: 0.85 },
  { id: "turquesa", nombre: "Turquesa", h: 195, c: 0.8 },
  { id: "cielo", nombre: "Cielo", h: 232, c: 0.85 },
  { id: "azul", nombre: "Azul", h: 260, c: 1 },
  { id: "indigo", nombre: "Índigo", h: 280, c: 0.9 },
  { id: "morado", nombre: "Morado", h: 305, c: 0.9 },
  { id: "magenta", nombre: "Magenta", h: 335, c: 1 },
  { id: "rosa", nombre: "Rosa", h: 355, c: 0.9 },
  { id: "cafe", nombre: "Café", h: 55, c: 0.4 },
  { id: "olivo", nombre: "Olivo", h: 110, c: 0.45 },
  { id: "pizarra", nombre: "Pizarra", h: 250, c: 0.25 },
  { id: "gris", nombre: "Gris", h: 70, c: 0.05 },
];
const RECETA: Record<Tono, { l: number; c: number }> = {
  vivo: { l: 0.58, c: 0.2 },
  mate: { l: 0.52, c: 0.075 },
  pastel: { l: 0.86, c: 0.075 },
  oscuro: { l: 0.36, c: 0.1 },
};
export function colorDe(familia: string, tono: Tono): string {
  const f = FAMILIAS.find((x) => x.id === familia) ?? FAMILIAS[0];
  const r = RECETA[tono];
  return aHex({ l: r.l, c: r.c * f.c, h: f.h });
}
/** Fondo de papel: siempre muy claro y poco saturado, para que el texto se lea igual con cualquier color. */
export function papelDe(hex: string, l = 0.965): string {
  const o = deHex(hex);
  return aHex({ l, c: Math.min(o.c, 0.035), h: o.h });
}
