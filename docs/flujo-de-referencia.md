# Flujo de referencia para la demo de mesas y comandas

Descripción de un video de otro producto de punto de venta para restaurantes. Se usa **solo como lista de pasos**: la demo propia lleva su propia marca, su propio diseño y datos inventados. No se copian nombres, tickets ni identidad de ese producto.

## Pasos

1. **Abrir mesa y comensales.** Se elige la mesa y se indica cuántos comensales hay (en el video, 3).
2. **Pedido por comensal.** Cada comensal tiene sus propios productos. La comanda queda desglosada por comensal antes de enviarse.
3. **Enviar a cocina.** Aparece la comandera digital en pantalla y se imprime una comandera en papel con el pedido por comensal y un resumen final de lo que hay que preparar.
4. **Estado de la mesa.** La mesa pasa a "Preparando". Cuando cocina marca la orden como lista, pasa a "Comiendo".
5. **Dividir cuenta y cobrar.** Dos modos: partes iguales o por productos. En el video se cobra por productos, en efectivo, hasta completar el total.
6. **Ticket y cierre.** Se imprime el ticket de venta. La mesa se cierra y queda "Libre".

## Lo que una demo puede y no puede hacer

| La demo puede simular | Requiere trabajo real, no se promete |
|---|---|
| Abrir mesa, comensales y pedidos con datos inventados | Impresora física de comandas y tickets |
| La comanda impresa como animación | Pantalla de cocina sincronizada entre dos aparatos |
| Cambio de estado de la mesa | Factura automática por código QR (conexión con el SAT) |
| Dividir la cuenta y cerrar la mesa | Cobro con terminal bancaria |

## Diseño y animación (decidido, no construido)

- Misma identidad que Taller Digital: grafito, vidrio solo en lo que flota, Saira Condensed y Barlow, la comanda como papel de rollo que se imprime.
- Pensada para tableta horizontal y para celular. Botones táctiles de al menos 44 px.
- Movimiento solo en transform y opacity, con salida suave, menos de 300 ms en la interfaz de uso diario. La impresión de la comanda sí puede durar más y se puede saltar.
- Revisión antes de enseñarla: accesibilidad, contraste, movimiento reducido y las revisiones de animación del repo `repo-negocio-`.
