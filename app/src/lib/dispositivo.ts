/** En teléfonos no se abre el teclado solo: en iOS mueve la página a media animación. */
export const conTeclado = typeof matchMedia !== "undefined" && matchMedia("(pointer: fine)").matches;
