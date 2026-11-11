# 📊 PostLinkedIn - Automatización de Prensa Económica & Infografías

Este proyecto automatiza la recopilación de prensa económica española de primer nivel, analiza la noticia de mayor impacto, redacta un post adaptado al perfil de un economista profesional, y diseña una infografía vertical de alta fidelidad 100% personalizable y descargable lista para publicar en LinkedIn.

---

## 🚀 Características Principales

1.  **Scraping y Consolidación de Prensa Matutina:**
    Escanea en tiempo real los principales diarios económicos de España: *Expansión*, *El Economista*, *Cinco Días*, *El País Economía* y *El Mundo Economía*.
2.  **Redacción con Tono Profesional de Economista:**
    Crea posts estructurados con ganchos comerciales, viñetas analíticas claras, emoticonos, hashtags discretos e hipervínculos requeridos.
3.  **Lienzo de Infografía de Alta Resolución (1080 x 1350 px):**
    Diseño visual ultra-nítido con gradientes de color inteligentes:
    *   🟢 **Verde Esmeralda** para noticias positivas.
    *   🔴 **Rojo Coral/Rubí** para noticias negativas.
4.  **Generación Dinámica sin Pixelación por IA:**
    En lugar de generar imágenes con texto corrupto por IA, renderiza texto vectorizado nítido mediante HTML5/CSS3 y exporta una imagen PNG perfecta utilizando `html2canvas`.
5.  **Acreditación Automática:**
    Añade en el pie de página de la infografía y del post la firma solicitada: *"Creado por http://mafede.i234.me con ayuda de Gemini"* con hipervínculos reales.
6.  **Panel de Control Local Premium:**
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
    **`http://localhost:3000`**

---

### Usuarios

La app tiene su propio sistema de usuarios (el mismo estándar que ContaMiki): registro con verificación del correo (enlace con token), inicio de sesión (JWT de 30 días), doble factor opcional con app autenticadora (TOTP), recuperación de contraseña por correo y cambio de contraseña. Todo lo que cuelga de `/api` exige sesión. Los datos viven en `DATA_DIR` (`users.json` y una carpeta por usuario con sus propuestas).

### Clave de Gemini

La generación de posts e infografías usa la API de Gemini y **cada usuario guarda su propia clave**: menú de usuario → **Mi perfil** → *Clave de Gemini* (se obtiene en Google AI Studio). Se almacena **cifrada** (AES-256-GCM, con una clave derivada de `JWT_SECRET`) en la cuenta del usuario y nunca se devuelve completa. Si cambias `JWT_SECRET`, las sesiones se cierran y cada usuario tendrá que volver a introducir su clave. No hace falta ninguna variable `GEMINI_API_KEY` en el servidor.

### Configuración (variables de entorno)

| Variable | Descripción |
|---|---|
| `JWT_SECRET` | **Obligatoria**, sin valor por defecto: firma las sesiones y cifra las claves de Gemini. Si falta, la app no arranca. Usa una cadena larga y aleatoria. |
| `APP_URL` | Dirección pública de la app (p. ej. `https://postlinkedin.midominio.com`); se usa en los enlaces de los correos. |
| `DATA_DIR` | Carpeta de datos (por defecto `./data`; en Docker, `/usr/src/app/data`, montada como volumen). |

**Correo** (verificación de cuenta y recuperación de contraseña): configura una de estas dos formas. Si defines las dos, se usa el servicio central.

- **Servicio de correo central:** `CENTRAL_EMAIL_URL` y `CENTRAL_EMAIL_KEY` (la app hace `POST <URL>/send` con `to`, `subject`, `text`, `html`, `key` y `fromName`).
- **SMTP directo:** `SMTP_HOST` (imprescindible), `SMTP_PORT` (587 por defecto; 465 usa TLS directo), `SMTP_SECURE` (`true` fuerza TLS directo), `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM` (remitente; por defecto `SMTP_USER`).
- Sin ninguna de las dos, los correos se escriben en el registro del contenedor (modo de prueba), de donde puedes copiar los enlaces.

---

## 📂 Estructura del Proyecto

*   `server.js`: Servidor en Express con los endpoints REST: lectura de prensa por RSS en tiempo real (botón «Actualizar Prensa»), generación con Gemini y propuestas de cada usuario.
*   `auth.js` y `mailer.js`: usuarios (registro, acceso, 2FA, recuperación, clave de Gemini cifrada) y envío de correo.
*   `sources.json`: Lista de diarios y feeds RSS de economía (puedes añadir o modificar fuentes aquí).
*   `data/` (volumen, no está en el repositorio): `users.json` y una carpeta por usuario con sus propuestas (`YYYY-MM-DD.json`).
*   `public/`: Código fuente de la interfaz web.
    *   `index.html`: Maquetación a doble columna (editor + previsualización).
    *   `style.css`: Estilo del panel de control y lienzo de la infografía.
    *   `app.js`: Sincronización en tiempo real y lógica de exportación a PNG.
    *   `auth.js` y `auth.css`: pantallas de acceso, perfil y menú de usuario.

---

*Creado por Antigravity y Gemini para mafede.i234.me*
