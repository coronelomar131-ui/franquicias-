# Restaurantes: herramientas a la medida

Línea de trabajo para restaurantes y fondas de CDMX, separada de la de refaccionarias (`repo-negocio-`).

## Estado (25 de octubre de 2026)

- Clientes: ninguno. Conversaciones con dueños: ninguna todavía.
- **Comandero (app real)**: en `app/`, conectada a Supabase. La demo de un solo archivo se retiró.
- La libreta de prospectos y el cotizador siguen publicados desde `repo-negocio-`, ya con guion, preguntas y mensaje para restaurantes.
- Hipótesis sin verificar: que los restaurantes chicos (fondas, taquerías, cafeterías) llevan hoy mesas y cuentas en libreta o WhatsApp. Solo se confirma hablando con dueños.

## La demo

Abre `index.html` en el navegador (celular o tableta). Con `?n=Nombre del negocio` al final de la dirección sale con el nombre de ese restaurante.

Recorrido: plano del salón → abrir mesa y elegir comensales → pedido por comensal → la comanda se imprime y viaja a cocina → en cocina se marca lista y la mesa pasa a "Comiendo" → cuenta por productos o en partes iguales, con efectivo (cambio) o tarjeta → ticket con QR → cerrar mesa.

Se simula, y la demo lo dice: la impresora, la pantalla de cocina en otro aparato, la terminal bancaria y la factura (el QR es de ejemplo, sin valor fiscal). Los datos viven en memoria: al recargar, la demo vuelve a empezar.

Probado en navegador de pruebas (Chromium) a 320, 390 y 1280 px, con movimiento reducido y con View Transitions. No probado en un celular real ni en Safari.

## Reglas

1. Un tipo de negocio, un dolor y un cliente hasta el primer pago.
2. No se construye en grande antes de tener un anticipo. Las demos usan datos inventados y lo dicen.
3. Primero conversar, después enseñar la demo.
4. Nada de mensajes masivos: uno por negocio, escrito para ese negocio.
5. No se inventan clientes, cifras ni resultados.

## Lo que sigue

1. Sacar 15 restaurantes de Google Maps (nombre, colonia, teléfono público) y cargarlos con la plantilla de la libreta.
2. Escribir a 5, uno por uno.
3. Meta de la semana: 2 conversaciones, no ventas. Anotar las respuestas textuales.
4. Con lo que digan, decidir si la demo de mesas y comandas sirve como está y cuánto cobrar por un piloto.

Detalle de las preguntas y del guion en `docs/descubrimiento.md`.
