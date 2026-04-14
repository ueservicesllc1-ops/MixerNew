# Informe Técnico: Arquitectura y Funcionamiento de Zion Stage Mixer

## 1. Arquitectura General
Zion Stage es una aplicación **Híbrida Premium** construida con el stack moderno de **React + Vite**. Utiliza **Capacitor** para ejecutarse de forma nativa en Android/iOS, permitiendo el acceso a hardware de bajo nivel (especialmente para el motor de audio) mientras mantiene una interfaz web de alta fidelidad.

### Capas del Sistema:
*   **Interfaz (Capa Web):** React 18 / Vite. Maneja la lógica de UI, el estado de la librería y la conexión con el motor de audio.
*   **Motor de Audio (Capa Nativa):** Implementado en **C (miniaudio)**. Procesa el audio con latencia ultra-baja y maneja la mezcla de hasta 16 canales simultáneos sin sobrecargar el hilo principal de JavaScript.
*   **Backend (Capa Serverless):** **Firebase Firestore** para datos en tiempo real y **Backblaze B2** para el alojamiento masivo de archivos (Multitracks).

---

## 2. El Motor de Audio (AudioEngine.js)
Es el corazón de la app. Tiene un sistema de **Fallback Inteligente**:
1.  **Modo Nativo (Capacitor):** Se comunica con un Plugin de C++ que gestiona buffers de memoria directa. Esto evita los cortes de audio clásicos de las apps web en Android.
2.  **Modo Web:** Si se abre en un navegador, usa la **Web Audio API** estándar.

### Flujo de Carga de una Canción:
1.  **Detección de Archivos:** La app verifica si los archivos ya existen localmente en la memoria de la tablet (FileSystem).
2.  **Descarga/Streaming:** Si no están, los descarga de Backblaze B2 y los guarda en el almacenamiento interno para que la próxima vez carguen instantáneamente (Cache Offline).
3.  **Decodificación:** El motor lee los MP3 y los prepara para el inicio sincronizado.

---

## 3. Base de Datos y Sincronización (Firebase)
Usamos Firestore con **Snapshots en tiempo real**.
*   **Librería Multitrack:** Cuando subes una canción en la web, la app en la tablet la recibe al instante sin necesidad de refrescar.
*   **Vincular Letras:** Las canciones se asocian mediante un sistema de ID con sus respectivas letras y cifrados importados desde fuentes como LaCuerda.net.
*   **Filtro VIP:** Para optimizar, la app pre-filtra la colección global para mostrar solo canciones que tengan archivos de audio válidos asociados.

---

## 4. Gestión de Archivos y Proxy B2
Dado que Backblaze B2 requiere firmas de seguridad complejas, la app utiliza un **Proxy Server (Node.js)** alojado en Railway:
*   El servidor recibe las subidas del panel de Admin.
*   Realiza subidas **Multipart** para manejar archivos pesados (ZIPs de multitracks) sin fallos de conexión.
*   Gestiona los CORS para que tanto la web como el APK puedan descargar los archivos de forma segura.

---

## 5. Optimizaciones de Rendimiento (Puntos Críticos)
Para asegurar que la app no sea lenta en tablets Android de gama media, se han implementado:
*   **Canvas VU Meters:** Los medidores de señal del mixer se dibujan pixel a pixel usando la GPU (Canvas 2D), evitando generar miles de objetos HTML que ralentizaban la tablet.
*   **Hardware Acceleration:** Forzado en el `AndroidManifest.xml` para que Android use el chip gráfico en toda la app.
*   **Memoización de React:** Los canales del mixer (ChannelStrips) solo se redibujan si sus valores cambian, ahorrando ciclos de CPU.

---

## 6. Estructura de Archivos Clave para Depuración

| Archivo | Función |
| :--- | :--- |
| `src/pages/Multitrack.jsx` | Pantalla principal. Controla la lógica de carga de canciones y la interfaz del reproductor. |
| `src/AudioEngine.js` | Puente entre JavaScript y el motor de audio nativo/web. |
| `src/components/Mixer.jsx` | Renderiza los faders y los medidores (Canvas). Optimizado para velocidad. |
| `src/pages/Admin.jsx` | Panel de control. Gestión de usuarios, marketplace y limpieza de letras. |
| `android/app/build.gradle` | Configuración de compilación del APK (Versiones, compatibilidad Java). |
| `b2-proxy.mjs` | Servidor externo que procesa las subidas de archivos. |

---

## 7. Posibles "Cuellos de Botella" y Soluciones
1.  **Saturación de Memoria:** Si se cargan muchas canciones seguidas sin cerrar la app, el motor libera los buffers anteriores automáticamente.
2.  **Latencia de Red:** La app prioriza el almacenamiento local (`FileSystem.writeFile`). Si una pista falla al descargar, el motor nativo la ignora para evitar que la app se cuelgue.
3.  **Renderizado UI:** Evitar añadir demasiados "Efectos Visuales" complejos en el mixer que no usen Canvas, ya que el WebView de Android es más sensible que el de una PC.

---

## 8. Siguiente Gran Épica (Next Major Epic): Visor de Banda Sincronizado Offline
Para la próxima iteración de características premium ("Zion Band Sync"), la arquitectura diseñada permitirá que el iPad/Tablet principal actúe como un **servidor web e inyector de WebSockets (`LocalHost`)**.
*   **Funcionamiento Cero Fricción:** La tablet principal emitirá una URL local (Ej: `http://192.168.x.x:8080`) a la cual los músicos accederán apuntando el código QR.
*   **Apertura Mágica en Navegador:** Se cargará una versión súper optimizada de la interfaz de letras y partituras de Zion Stage directamente en el navegador de los músicos, *sin requerir descargas previas ni registro en cuentas*.
*   **Comunicación Offline Total:** Se garantiza sincronización (`Play`, `Stop`, `Jump to Section`) de 0 milisegundos de latencia por red Wi-Fi LAN, eliminando permanentemente la dependencia de internet en los recintos de ensayo e iglesias, evitando saturaciones en la capa de Firestore/Firebase.
