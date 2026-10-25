/** Foto de la persona, o su inicial si todavía no tiene. */
export function Cara({ nombre, foto, className = "cara-ini" }: { nombre: string; foto?: string | null; className?: string }) {
  return (
    <span className={className + (foto ? " con-foto" : "")} aria-hidden="true">
      {foto ? <img src={foto} alt="" loading="lazy" decoding="async" /> : nombre.trim().charAt(0).toUpperCase()}
    </span>
  );
}
