import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useSesion } from "../estado/sesion";
import { useEquipo } from "../estado/equipo";
import type { Empleado } from "../lib/tipos";
import { mensajeError } from "../lib/formato";
import { useAviso } from "../componentes/Aviso";
import { Icono } from "../componentes/Icono";

const PUESTO: Record<Empleado["rol"], string> = { mesero: "Mesero", cocina: "Cocina", caja: "Caja", gerente: "Gerente" };
const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Pantalla de la tableta en modo equipo: cada quien toca su nombre y pone su PIN. */
export function Bloqueo({ rid }: { rid: string }) {
  const { actual } = useSesion();
  const avisar = useAviso();
  const [gente, setGente] = useState<Empleado[] | null>(null);
  const [quien, setQuien] = useState<Empleado | null>(null);
  const [dueno, setDueno] = useState(false);

  useEffect(() => {
    supabase.from("empleados").select("id, restaurante_id, nombre, rol, activo").eq("restaurante_id", rid).eq("activo", true).order("nombre")
      .then(({ data, error }) => { if (error) { avisar(mensajeError(error), "error"); setGente([]); } else setGente((data ?? []) as Empleado[]); });
  }, [rid, avisar]);

  return (
    <div className="bloqueo">
      <header className="bloqueo-cab">
        {actual?.logo_url ? <img src={actual.logo_url} alt="" width={56} height={56} /> : <span className="bloqueo-ini" aria-hidden="true">{actual?.nombre.charAt(0).toUpperCase()}</span>}
        <span translate="no">{actual?.nombre}</span>
        <Hora />
      </header>

      {dueno ? <ClaveDueno onVolver={() => setDueno(false)} />
        : quien ? <Teclado key={quien.id} rid={rid} persona={quien} onVolver={() => setQuien(null)} />
        : (
          <section className="bloqueo-quien" aria-labelledby="quien-t">
            <h1 id="quien-t" className="titulo" tabIndex={-1}>¿Quién entra?</h1>
            {gente === null ? <p className="sub espera">Cargando equipo…</p> : gente.length === 0 ? (
              <p className="sub">No hay nadie dado de alta. El dueño tiene que agregar al equipo en Ajustes.</p>
            ) : (
              <ul className="caras escalon">
                {gente.map((g, i) => (
                  <li key={g.id} style={{ ["--i" as string]: i }}>
                    <button type="button" className="cara" onClick={() => setQuien(g)}>
                      <span className="cara-ini" aria-hidden="true">{g.nombre.trim().charAt(0).toUpperCase()}</span>
                      <b>{g.nombre}</b>
                      <small>{PUESTO[g.rol]}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

      {!dueno && <button type="button" className="texto bloqueo-dueno" onClick={() => { setQuien(null); setDueno(true); }}>Soy el dueño</button>}
    </div>
  );
}

function Hora() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => { const t = window.setInterval(() => setAhora(new Date()), 15000); return () => window.clearInterval(t); }, []);
  return <time className="bloqueo-hora" dateTime={ahora.toISOString()}>{ahora.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })}</time>;
}

function Teclado({ rid, persona, onVolver }: { rid: string; persona: Empleado; onVolver: () => void }) {
  const { entrar } = useEquipo();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [probando, setProbando] = useState(false);
  const [sacude, setSacude] = useState(0);
  const caja = useRef<HTMLDivElement>(null);

  const probar = useCallback(async (valor: string) => {
    if (valor.length < 4 || probando) return;
    setProbando(true);
    const { data, error: e } = await supabase.rpc("validar_pin", { p_restaurante: rid, p_empleado: persona.id, p_pin: valor });
    setProbando(false);
    if (e) { setError(mensajeError(e)); setPin(""); setSacude((n) => n + 1); return; }
    if (data === true) { entrar(persona); return; }
    setError("PIN incorrecto"); setPin(""); setSacude((n) => n + 1);
  }, [rid, persona, probando, entrar]);

  // Sin efectos dentro de setPin: en modo estricto se llamaría dos veces y gastaría dos intentos
  const teclear = useCallback((d: string) => {
    if (pin.length >= 6 || probando) return;
    const n = pin + d;
    setError(""); setPin(n);
    if (n.length === 6) void probar(n);
  }, [pin, probando, probar]);
  const borrar = () => { setError(""); setPin((p) => p.slice(0, -1)); };

  // Teclado físico (tabletas con teclado o compu en caja)
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

  useEffect(() => { caja.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true }); }, []);

  const puntos = Math.max(4, pin.length);
  return (
    <section className="teclado entra" ref={caja} aria-labelledby="pin-t">
      <button type="button" className="vuelta" onClick={onVolver}><Icono n="atras" tam={20} />Cambiar</button>
      <h1 id="pin-t" className="teclado-nom" tabIndex={-1}>{persona.nombre}</h1>
      <p className="sub">Pon tu PIN</p>
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

function ClaveDueno({ onVolver }: { onVolver: () => void }) {
  const { sesion } = useSesion();
  const { desactivar } = useEquipo();
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const correo = sesion?.user.email ?? "";

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email: correo, password: clave });
    setEnviando(false);
    if (err) { setError(err.message.toLowerCase().includes("invalid") ? "Contraseña incorrecta" : mensajeError(err)); setClave(""); return; }
    desactivar();
  }
  return (
    <form className="teclado entra pila" onSubmit={enviar}>
      <button type="button" className="vuelta" onClick={onVolver}><Icono n="atras" tam={20} />Volver</button>
      <h1 className="titulo" tabIndex={-1}>Salir del modo equipo</h1>
      <p className="sub">Pon la contraseña de <b>{correo}</b>. La tableta vuelve a tener todo: menú, ajustes y equipo.</p>
      <label className="campo"><span>Contraseña</span>
        <input className="entrada" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primario" type="submit" disabled={enviando || !clave}>{enviando ? "Revisando…" : "Salir del modo equipo"}</button>
    </form>
  );
}
