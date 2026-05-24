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

## 📂 Estructura del Proyecto

*   `server.js`: Servidor local en Express con endpoints REST para el scraping de RSS y persistencia de propuestas diarias.
*   `sources.json`: Lista de diarios y feeds RSS de economía (puedes añadir o modificar fuentes aquí).
*   `scrape_news.js`: Script independiente que puede ejecutar el agente o un cron job para obtener las noticias.
*   `proposals/`: Carpeta que almacena el historial de propuestas diarias en archivos JSON (`YYYY-MM-DD.json`).
*   `public/`: Código fuente de la interfaz web.
    *   `index.html`: Maquetación a doble columna (editor + previsualización).
    *   `style.css`: Estilo del panel de control y lienzo de la infografía.
    *   `app.js`: Sincronización en tiempo real y lógica de exportación a PNG.

---

## ⏰ Programación Diaria (A las 6:00 AM)

El agente **Antigravity** tiene configurada una tarea programada para ejecutarse todos los días a las **6:00 AM** (hora local de España). 
El proceso diario automático consiste en:
1.  Ejecutar el script de escaneo de prensa para recuperar las portadas económicas de la mañana.
2.  Evaluar qué noticia ha acumulado el mayor impacto mediático o repetición.
3.  Diseñar la propuesta del post diario y estructurar los puntos clave, el sentimiento y la métrica de la infografía.
4.  Guardar la propuesta en `proposals/latest.json` y en el archivo con la fecha correspondiente.
5.  Enviarte un aviso al chat indicando que ya puedes revisar tu propuesta de hoy en el panel de control.

---

*Creado por Antigravity y Gemini para mafede.i234.me*
