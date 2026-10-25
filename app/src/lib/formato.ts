const d2 = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const d0 = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** Centavos a pesos; sin decimales cuando son pesos cerrados. */
export const pesos = (c: number) => (c % 100 === 0 ? d0 : d2).format(c / 100);

/** Texto escrito por la persona ("95", "$1,250.50") a centavos; null si no es un número. */
export function aCentavos(texto: string): number | null {
  const limpio = texto.replace(/[^0-9.]/g, "");
  if (!limpio) return null;
  const v = Number(limpio);
  return Number.isFinite(v) ? Math.round(v * 100) : null;
}

export const minutosDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));

const TRADUCCIONES: [RegExp, string][] = [
  [/invalid login credentials/i, "Correo o contraseña incorrectos."],
  [/email not confirmed/i, "Confirma tu correo: te mandamos un enlace."],
  [/user already registered/i, "Ya hay una cuenta con ese correo. Entra con tu contraseña."],
  [/password should be at least/i, "La contraseña debe tener al menos 6 caracteres."],
  [/unable to validate email|invalid email/i, "Ese correo no parece válido."],
  [/rate limit|too many requests/i, "Demasiados intentos. Espera un momento y vuelve a probar."],
  [/failed to fetch|networkerror|load failed/i, "Sin conexión con el servidor. Revisa tu internet."],
  [/duplicate key value/i, "Ya existe un registro igual."],
  [/violates check constraint/i, "Algún dato no es válido. Revisa los campos."],
  [/row-level security|permission denied/i, "No tienes permiso para hacer eso."],
];

/** Mensaje en español para la persona; los errores de nuestras funciones ya vienen en español. */
export function mensajeError(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  for (const [re, txt] of TRADUCCIONES) if (re.test(m)) return txt;
  return m || "Algo salió mal. Intenta de nuevo.";
}
