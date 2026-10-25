import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Fn = (msg: string, tipo?: "ok" | "error") => void;
const Ctx = createContext<Fn>(() => {});
export const useAviso = () => useContext(Ctx);

export function ProveedorAviso({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<{ msg: string; tipo: "ok" | "error"; on: boolean }>({ msg: "", tipo: "ok", on: false });
  const t = useRef<number>();
  const avisar = useCallback<Fn>((msg, tipo = "ok") => {
    setEstado({ msg, tipo, on: true });
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setEstado((e) => ({ ...e, on: false })), tipo === "error" ? 4200 : 2600);
  }, []);
  return (
    <Ctx.Provider value={avisar}>
      {children}
      <div className={"toast vidrio" + (estado.on ? " on" : "") + (estado.tipo === "error" ? " error" : "")} role={estado.tipo === "error" ? "alert" : "status"} aria-live="polite">
        {estado.msg}
      </div>
    </Ctx.Provider>
  );
}
