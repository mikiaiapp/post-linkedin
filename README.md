# 📊 PostLinkedIn - Automatización de Prensa Económica & Infografías

Este proyecto automatiza la recopilación de prensa económica española de primer nivel, analiza la noticia de mayor impacto, redacta un post adaptado al perfil de un economista profesional, y diseña una infografía vertical de alta fidelidad 100% personalizable y descargable lista para publicar en LinkedIn.

---

## 🚀 Características Principales

1.  **Scraping y Consolidación de Prensa Matutina:**
    Escanea en tiempo real los principales diarios económicos de España: *Expansión*, *El Economista*, *Cinco Días*, *El País Economía* y *El Mundo Economía*.
    Las noticias salen **ordenadas por impacto en las últimas 24 horas**: cuántos diarios distintos cubren el mismo tema (🔥 *N diarios*), la frescura y la presencia de temas clave (IPC, tipos, aranceles, deuda…). Las de más de 24 horas van después, por fecha.
    La lista ocupa **toda la anchura** de la pantalla, con búsqueda, filtro por fuente, orden (impacto o más recientes) y «solo últimas 24 h».
    **Fuentes RSS por usuario:** el botón «⚙️ Fuentes» permite añadir (con prueba previa), quitar y editar las fuentes de cada usuario, o volver a las de por defecto (`sources.json`). Por seguridad, el servidor solo lee direcciones públicas: nunca las de la red interna.
    **Noticia por enlace:** pega la dirección de cualquier noticia y pulsa «Traer noticia»: se lee el título, el resumen y los primeros párrafos para que los revises y generes el post. Si el sitio bloquea la lectura automática, usa «Pegar texto».
2.  **Redacción con Tono Profesional de Economista:**
    Crea posts estructurados con ganchos comerciales, viñetas analíticas claras, emoticonos, hashtags discretos e hipervínculos requeridos.
3.  **Lienzo de Infografía de Alta Resolución (1080 x 1350 px):**
    Diseño de **alto impacto visual**: titular enorme en un bloque de color, cifra gigante, tres datos clave, gráfico de barras comparativo, tres claves, impacto en mercados y una conclusión destacada. La IA rellena todos los campos y el texto se ajusta solo para que quepa. Los colores cambian según la noticia:
    *   🟢 **Verde Esmeralda** para noticias positivas.
    *   🔴 **Rojo Coral/Rubí** para noticias negativas.
4.  **Infografía ilustrada con IA (Nano Banana):**
    Para las noticias que se prestan (rankings, mapas, escenarios con cifras, comparativas…), la IA actúa como director de arte, elige un estilo (escenarios, ranking, mapa, KPI con ilustración 3D, retratos, dashboard, tabla con pictogramas, árbol) y el modelo de imagen de Gemini dibuja la infografía completa: ilustraciones, mapas, gráficos y esquemas. Si la noticia no se presta, se usa la plantilla. Las instrucciones para la imagen son editables y se puede regenerar. Se usa la clave de Gemini de cada usuario (los modelos de imagen son de pago: por defecto **Nano Banana 2.1**, `gemini-nano-banana-2.1`, la última versión; también **Nano Banana Pro**, `gemini-3-pro-image`, de mayor fidelidad; se usa la Interactions API de Google con imagen 4:5 a 2K). El texto dentro de una imagen de IA puede tener erratas: revísalo antes de publicar.
5.  **Plantilla sin pixelación (modo seguro):**
    En lugar de generar imágenes con texto corrupto por IA, renderiza texto vectorizado nítido mediante HTML5/CSS3 y exporta una imagen PNG perfecta utilizando `html2canvas`.
6.  **Acreditación Automática:**
    Añade en el pie de página de la infografía y del post la firma solicitada: *"Creado por http://mafede.i234.me con ayuda de Gemini"* con hipervínculos reales.
7.  **Panel de Control Local Premium:**
    Una interfaz moderna con estética *glassmorphism* oscura para que puedas editar en vivo la infografía o el post antes de descargarlos.

---

## 🛠️ Cómo Empezar

### Requisitos Previos
*   Tener **Node.js** (versión 18 o superior) instalado en el equipo.

### Instrucciones de Arranque

1.  Instala las dependencias necesarias ejecutando en la terminal dentro de este directorio:
    ```bash
    npm install
    ```
2.  Inicia el servidor local de desarrollo:
    ```bash
    npm run dev
    ```
3.  Abre tu navegador de preferencia e ingresa a:
    **`http://localhost:3080`**

---

### Usuarios

La app tiene su propio sistema de usuarios (el mismo estándar que ContaMiki): registro con verificación del correo (enlace con token), inicio de sesión (JWT de 30 días), doble factor opcional con app autenticadora (TOTP), recuperación de contraseña por correo y cambio de contraseña. Todo lo que cuelga de `/api` exige sesión. Los datos viven en `DATA_DIR` (`users.json` y una carpeta por usuario con sus propuestas).

### Clave de Gemini

La generación de posts e infografías usa la API de Gemini y **cada usuario guarda su propia clave**: menú de usuario → **Mi perfil** → *Clave de Gemini* (se obtiene en Google AI Studio). Se almacena **cifrada** (AES-256-GCM, con una clave derivada de `JWT_SECRET`) en la cuenta del usuario y nunca se devuelve completa. Si cambias `JWT_SECRET`, las sesiones se cierran y cada usuario tendrá que volver a introducir su clave. No hace falta ninguna variable `GEMINI_API_KEY` en el servidor.

El botón **Probar** del perfil comprueba la clave (la que has escrito o, si el campo está vacío, la guardada) y distingue una clave inválida de un servicio saturado. Si Google responde «saturado» (503), la app reintenta y, para las imágenes, prueba otro modelo; si la clave no tiene cuota de imagen se explica en claro. Los modelos de imagen son de pago: la clave debe tener la facturación activada en Google AI Studio.

### Configuración (variables de entorno)

| Variable | Descripción |
|---|---|
| `JWT_SECRET` | **Obligatoria**, sin valor por defecto: firma las sesiones y cifra las claves de Gemini. Si falta, la app no arranca. Usa una cadena larga y aleatoria. |
| `APP_URL` | Dirección pública de la app (p. ej. `https://postlinkedin.midominio.com`); se usa en los enlaces de los correos. |
| `DATA_DIR` | Carpeta de datos (por defecto `./data`; en Docker, `/usr/src/app/data`, montada como volumen). |
| `PORT` | Puerto de la app (3080 por defecto). |
| `GEMINI_IMAGE_SIZE` | Opcional: tamaño de la imagen de IA, `1K`, `2K` (por defecto) o `4K`. |
| `GEMINI_API_REVISION`, `GEMINI_BASE_URL` | Opcionales, para fijar la revisión de la API de Google o usar otro servidor compatible. |

**Correo** (verificación de cuenta y recuperación de contraseña): configura una de estas dos formas. Si defines las dos, se usa el servicio central.

- **Servicio de correo central:** `CENTRAL_EMAIL_URL` y `CENTRAL_EMAIL_KEY` (la app hace `POST <URL>/send` con `to`, `subject`, `text`, `html`, `key` y `fromName`).
- **SMTP directo:** `SMTP_HOST` (imprescindible), `SMTP_PORT` (587 por defecto; 465 usa TLS directo), `SMTP_SECURE` (`true` fuerza TLS directo), `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM` (remitente; por defecto `SMTP_USER`).
- Sin ninguna de las dos, los correos se escriben en el registro del contenedor (modo de prueba), de donde puedes copiar los enlaces.

---

## 📂 Estructura del Proyecto

*   `server.js`: Servidor en Express con los endpoints REST: lectura de prensa por RSS en tiempo real (botón «Actualizar Prensa»), generación con Gemini y propuestas de cada usuario.
*   `auth.js` y `mailer.js`: usuarios (registro, acceso, 2FA, recuperación, clave de Gemini cifrada) y envío de correo.
*   `imagen.js`: infografía ilustrada con IA (Interactions API de Gemini, reintentos y cascada de modelos). `noticias.js`: lectura de prensa, fuentes por usuario y noticia por enlace. `ranking.js`: orden de las noticias por impacto.
*   `sources.json`: Lista de diarios y feeds RSS de economía (puedes añadir o modificar fuentes aquí).
*   `data/` (volumen, no está en el repositorio): `users.json` y una carpeta por usuario con sus propuestas (`YYYY-MM-DD.json`).
*   `public/`: Código fuente de la interfaz web.
    *   `index.html`: Maquetación a doble columna (editor + previsualización).
    *   `style.css`: Estilo del panel de control y lienzo de la infografía.
    *   `app.js`: Sincronización en tiempo real y lógica de exportación a PNG.
    *   `auth.js` y `auth.css`: pantallas de acceso, perfil y menú de usuario.
    *   `news.js` y `news.css`: sección de noticias (búsqueda, filtros, fuentes y noticia por enlace). `infographic.css`: lienzo de la infografía.

**En el móvil:** zoom con la pinza permitido y deslizar hacia abajo desde arriba para actualizar.

---

*Creado por Antigravity y Gemini para mafede.i234.me*
