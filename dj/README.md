# DJ Maquiavélico

App web (HTML, CSS y JS sin compilar) que controla tu Spotify con la API oficial.
Es un proyecto aparte del Comandero: no comparte código ni base de datos.

## Qué hace

- Login con Spotify (PKCE: sin servidor y sin Client Secret).
- Play, pausa, anterior, siguiente, volumen y elegir bocina (celular, compu, bocina, tele).
- En compu de escritorio el navegador puede sonar como bocina (Web Playback SDK). En celular funciona como control remoto.
- Auto-DJ: fade al final de cada canción (baja volumen, pasa a la siguiente, lo sube), duración máxima por canción y saltar intro.
- Buscar canciones, ponerlas ya o agregarlas a la cola.
- Pantalla para invitados a pantalla completa (salir: 3 toques en la esquina superior derecha).
- Panel secreto (5 toques al logo):
  - Modo "Prender la fiesta": sube de nivel (pop latino → cumbia → reggaetón → perreo) y +3 % de volumen por canción.
  - Modo "Correr a los invitados": baladas → boleros → tristes → piano para dormir y −5 % de volumen por canción.
  - Comodines y votación arreglada: los invitados votan entre dos canciones y siempre gana el comodín.

## Límites reales

- Spotify pide **Premium** para controlar la reproducción.
- No mezcla ni encima canciones: las reglas de Spotify lo prohíben y la API no da acceso al audio.
- Spotify cerró a las apps nuevas los datos de BPM y energía; los niveles se arman con búsquedas por género.
- En modo desarrollo solo entran las cuentas que agregues en "User Management" del dashboard de Spotify.

## Configurar

1. developer.spotify.com/dashboard → Create app.
2. Redirect URI: la dirección exacta donde se abre la app (la app la muestra con botón de copiar).
3. Marcar Web API y Web Playback SDK.
4. Pegar el Client ID en la app.

## Probado

Con Spotify simulado en Chromium (390 px): login PKCE, cabina, fade automático, búsqueda, comodines,
modo "Prender", votación arreglada y brinco al comodín. Falta probar con una cuenta real de Spotify.
