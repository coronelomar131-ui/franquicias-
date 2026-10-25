export type Forma = "cuadrada" | "redonda" | "larga";
export type Rol = "gerente" | "mesero" | "cocina" | "caja";

export interface Restaurante { id: string; nombre: string; zona_horaria: string; }
export interface Categoria { id: string; restaurante_id: string; nombre: string; orden: number; activa: boolean; }
export interface Producto {
  id: string; restaurante_id: string; categoria_id: string | null; nombre: string; descripcion: string;
  precio_centavos: number; activo: boolean; orden: number;
}
export interface Mesa { id: string; restaurante_id: string; nombre: string; forma: Forma; lugares: number; orden: number; activa: boolean; }
export interface Empleado { id: string; restaurante_id: string; nombre: string; rol: Rol; activo: boolean; }
export interface Orden {
  id: string; restaurante_id: string; mesa_id: string | null; folio: number; comensales: number;
  estado: "abierta" | "pagada" | "cancelada"; abierta_en: string;
}
