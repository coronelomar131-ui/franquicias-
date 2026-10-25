import { useEffect, useState } from "react";

export type Ruta = "salon" | "menu" | "mesas" | "equipo" | "nuevo";
const VALIDAS: Ruta[] = ["salon", "menu", "mesas", "equipo", "nuevo"];
const leer = (): Ruta => { const r = location.hash.replace(/^#\/?/, "") as Ruta; return VALIDAS.includes(r) ? r : "salon"; };

export function useRuta(): [Ruta, (r: Ruta) => void] {
  const [ruta, setRuta] = useState<Ruta>(leer);
  useEffect(() => { const f = () => setRuta(leer()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return [ruta, (r) => { if (r !== ruta) location.hash = "/" + r; }];
}
