import { useEffect, useState } from "react";

export type Ruta = "salon" | "cocina" | "menu" | "ajustes" | "nuevo" | "pedido";
const VALIDAS: Ruta[] = ["salon", "cocina", "menu", "ajustes", "nuevo", "pedido"];
export interface Lugar { ruta: Ruta; param: string | null; }

function leer(): Lugar {
  const [r, p] = location.hash.replace(/^#\/?/, "").split("/");
  const ruta = VALIDAS.includes(r as Ruta) ? (r as Ruta) : "salon";
  if (ruta === "pedido" && !p) return { ruta: "salon", param: null };
  return { ruta, param: p ? decodeURIComponent(p) : null };
}

export function useRuta(): [Lugar, (r: Ruta, param?: string) => void] {
  const [lugar, setLugar] = useState<Lugar>(leer);
  useEffect(() => { const f = () => setLugar(leer()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return [lugar, (r, param) => { location.hash = "/" + r + (param ? "/" + encodeURIComponent(param) : ""); }];
}
