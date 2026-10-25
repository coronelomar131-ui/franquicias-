export type Forma = "cuadrada" | "redonda" | "larga";
export type Rol = "gerente" | "mesero" | "cocina" | "caja";

export type ColorMarca = "achiote" | "vino" | "nopal" | "talavera" | "mostaza" | "rosa" | "tinta";
export type Tipografia = "fonda" | "bistro" | "moderna" | "cantina";
export type Fondo = "crema" | "blanco" | "arena" | "salvia";
export interface Restaurante {
  id: string; nombre: string; zona_horaria: string; logo_url: string | null;
  color_marca: ColorMarca; tipografia: Tipografia; fondo: Fondo; eslogan: string;
  color_principal: string | null; color_secundario: string | null; color_fondo: string | null;
  codigo_equipo?: string;
}
export interface Categoria { id: string; restaurante_id: string; nombre: string; orden: number; activa: boolean; }
export interface Producto {
  id: string; restaurante_id: string; categoria_id: string | null; nombre: string; descripcion: string;
  precio_centavos: number; activo: boolean; orden: number; foto_url: string | null;
}
export interface Mesa { id: string; restaurante_id: string; nombre: string; forma: Forma; lugares: number; orden: number; activa: boolean; }
export interface Empleado { id: string; restaurante_id: string; nombre: string; rol: Rol; activo: boolean; foto_url?: string | null; }
export interface Orden {
  id: string; restaurante_id: string; mesa_id: string | null; folio: number; comensales: number;
  estado: "abierta" | "pagada" | "cancelada"; abierta_en: string;
}
export interface Renglon {
  id: string; restaurante_id: string; orden_id: string; producto_id: string | null; nombre: string; precio_centavos: number;
  cantidad: number; comensal: number; nota: string; comanda_id: string | null; pagado: boolean; cancelado: boolean; creado_en: string;
}
export interface Comanda { id: string; restaurante_id: string; orden_id: string; ronda: number; estado: "pendiente" | "lista"; enviada_en: string; lista_en: string | null; }
