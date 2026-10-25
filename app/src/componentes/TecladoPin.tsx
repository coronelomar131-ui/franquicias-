import { useCallback, useEffect, useRef, useState } from "react";
import { Icono } from "./Icono";
import { Cara } from "./Cara";

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Teclado de PIN en pantalla (también acepta el teclado físico). onProbar regresa el error o null si entró. */
export function TecladoPin({ nombre, foto, onProbar, onVolver }: { nombre: string; foto?: string | null; onProbar: (pin: string) => Promise<string | null>; onVolver: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [probando, setProbando] = useState(false);
  const [sacude, setSacude] = useState(0);
  const caja = useRef<HTMLElement>(null);

  const probar = useCallback(async (valor: string) => {
    if (valor.length < 4 || probando) return;
    setProbando(true);
    const err = await onProbar(valor);
    setProbando(false);
    if (err) { setError(err); setPin(""); setSacude((n) => n + 1); }
  }, [probando, onProbar]);

  // Sin efectos dentro de setPin: en modo estricto se llamaría dos veces y gastaría dos intentos
  const teclear = useCallback((d: string) => {
    if (pin.length >= 6 || probando) return;
    const n = pin + d;
    setError(""); setPin(n);
    if (n.length === 6) void probar(n);
  }, [pin, probando, probar]);
  const borrar = () => { setError(""); setPin((p) => p.slice(0, -1)); };

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) teclear(e.key);
      else if (e.key === "Backspace") borrar();
      else if (e.key === "Enter") void probar(pin);
      else if (e.key === "Escape") onVolver();
    };
    addEventListener("keydown", f);
    return () => removeEventListener("keydown", f);
  }, [teclear, probar, pin, onVolver]);
  useEffect(() => { caja.current?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true }); }, []);

  const puntos = Math.max(4, pin.length);
  return (
    <section className="teclado entra" ref={caja} aria-labelledby="pin-t">
      <button type="button" className="vuelta" onClick={onVolver}><Icono n="atras" tam={20} />Cambiar</button>
      <Cara nombre={nombre} foto={foto} className="cara-ini grande" />
      <h2 id="pin-t" className="teclado-nom" tabIndex={-1}>{nombre}</h2>
      <p className="sub">{probando ? "Revisando…" : "Pon tu PIN"}</p>
      <div key={sacude} className={"pin-puntos" + (sacude ? " sacude" : "")} role="img" aria-label={`${pin.length} de ${puntos} números`}>
        {Array.from({ length: puntos }, (_, i) => <i key={i} className={i < pin.length ? "lleno" : ""} />)}
      </div>
      <p className="error teclado-error" role="alert">{error}</p>
      <div className="teclas">
        {TECLAS.map((d) => <button key={d} type="button" className="tecla" onClick={() => teclear(d)} disabled={probando}>{d}</button>)}
        <button type="button" className="tecla suave" onClick={borrar} disabled={!pin || probando} aria-label="Borrar"><Icono n="atras" tam={24} /></button>
        <button type="button" className="tecla" onClick={() => teclear("0")} disabled={probando}>0</button>
        <button type="button" className="tecla ok" onClick={() => probar(pin)} disabled={pin.length < 4 || probando} aria-label="Entrar"><Icono n="ok" tam={26} /></button>
      </div>
    </section>
  );
}
