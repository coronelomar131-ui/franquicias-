/** Impresión de comandas en cocina. Se configura en cada aparato (no es del restaurante). */
export type ModoImpresion = "sistema" | "rawbt";
export interface ConfigImpresion { auto: boolean; modo: ModoImpresion; ancho: 58 | 80 }
const LLAVE = "comandero:impresion";
const IMPRESAS = "comandero:impresas";

export function leerConfig(): ConfigImpresion {
  try { return { auto: false, modo: "sistema", ancho: 80, ...(JSON.parse(localStorage.getItem(LLAVE) ?? "{}") as Partial<ConfigImpresion>) }; }
  catch { return { auto: false, modo: "sistema", ancho: 80 }; }
}
export function guardarConfig(c: ConfigImpresion) { try { localStorage.setItem(LLAVE, JSON.stringify(c)); } catch { /* sin almacenamiento */ } }

/** Comandas que ya salieron en este aparato, para no imprimir dos veces al recargar. */
export function yaImpresas(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(IMPRESAS) ?? "[]") as string[]); } catch { return new Set(); } }
export function marcarImpresas(ids: string[]) {
  const s = [...yaImpresas(), ...ids].slice(-300);
  try { localStorage.setItem(IMPRESAS, JSON.stringify(s)); } catch { /* sin almacenamiento */ }
}

export interface ComandaParaImprimir {
  mesa: string; ronda: number; folio: number; enviada_en: string; restaurante: string;
  renglones: { nombre: string; cantidad: number; comensal: number; nota: string }[];
}

// Las impresoras térmicas baratas no traen acentos: se quitan para que no salgan signos raros
const ascii = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ñ/g, "n").replace(/Ñ/g, "N").replace(/[^\x20-\x7E]/g, "");

function partir(texto: string, ancho: number, sangria: number): string[] {
  const palabras = texto.split(/\s+/); const out: string[] = []; let linea = "";
  for (const p of palabras) {
    if ((linea + " " + p).trim().length > ancho - (out.length ? sangria : 0)) { out.push(linea.trim()); linea = p; }
    else linea += " " + p;
  }
  if (linea.trim()) out.push(linea.trim());
  return out.map((l, i) => (i ? " ".repeat(sangria) + l : l));
}

/** Comanda en ESC/POS: el idioma de las impresoras de tickets. Mesa en grande, por comensal y corte de papel. */
export function escpos(c: ComandaParaImprimir, ancho: 58 | 80): Uint8Array {
  const cols = ancho === 58 ? 32 : 48;
  const ESC = 0x1b, GS = 0x1d;
  const b: number[] = [];
  const txt = (s: string) => { for (const ch of ascii(s)) b.push(ch.charCodeAt(0)); b.push(0x0a); };
  const hora = new Date(c.enviada_en).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  b.push(ESC, 0x40);                       // reinicia
  b.push(ESC, 0x61, 1);                    // centrado
  txt(c.restaurante.toUpperCase());
  b.push(GS, 0x21, 0x11, ESC, 0x45, 1);    // doble tamaño y negritas
  txt(`MESA ${c.mesa}`);
  b.push(GS, 0x21, 0x00);
  txt(`RONDA ${c.ronda}`);
  b.push(ESC, 0x45, 0);
  txt(`${hora}  Folio ${c.folio || "-"}`);
  b.push(ESC, 0x61, 0);                    // a la izquierda
  txt("-".repeat(cols));
  const comensales = [...new Set(c.renglones.map((r) => r.comensal))].sort((x, y) => x - y);
  for (const n of comensales) {
    b.push(ESC, 0x45, 1); txt(`Comensal ${n}`); b.push(ESC, 0x45, 0);
    for (const r of c.renglones.filter((x) => x.comensal === n)) {
      b.push(GS, 0x21, 0x01);              // alto doble: se lee de lejos
      for (const l of partir(`${r.cantidad}x ${r.nombre}`, cols, 3)) txt(l);
      b.push(GS, 0x21, 0x00);
      if (r.nota) for (const l of partir(`>> ${r.nota}`, cols - 3, 3)) txt("   " + l);
    }
  }
  txt("-".repeat(cols));
  b.push(ESC, 0x64, 4);                    // avanza papel
  b.push(GS, 0x56, 0x42, 0);               // corta
  return new Uint8Array(b);
}

/** Manda la comanda a la app RawBT (Android): imprime en la impresora Bluetooth sin preguntar. */
export function imprimirRawBT(bytes: Uint8Array) {
  let bin = "";
  bytes.forEach((x) => { bin += String.fromCharCode(x); });
  window.location.href = "rawbt:base64," + btoa(bin);
}
