const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const auth = require('./auth');
const { ordenarPorImpacto } = require('./ranking');
const imagen = require('./imagen');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3080;
const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  requestOptions: {
    rejectUnauthorized: false // Ignora fallos de certificado SSL para lectura robusta en NAS o Windows
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Usuarios: registro, acceso, 2FA, recuperación y clave de Gemini. Todo lo que cuelga de /api exige sesión
// salvo las rutas públicas de acceso definidas en auth.js.
app.use('/api', auth.router);

// Rutas de archivos
const SOURCES_FILE = path.join(__dirname, 'sources.json');

const DEFAULT_SOURCES = [
  {
    "name": "Expansión - Economía",
    "url": "https://www.expansion.com/rss/economia.xml",
    "category": "Economía General"
  },
  {
    "name": "El Economista - Nacional",
    "url": "https://www.eleconomista.es/rss/rss-economia.php",
    "category": "Economía General"
  },
  {
    "name": "Cinco Días - Economía",
    "url": "https://cincodias.elpais.com/seccion/rss/economia/",
    "category": "Economía & Finanzas"
  },
  {
    "name": "El País - Economía",
    "url": "https://elpais.com/rss/economia/portada.xml",
    "category": "Macroeconomía"
  },
  {
    "name": "El Mundo - Economía",
    "url": "https://www.elmundo.es/rss/economia.xml",
    "category": "Macroeconomía"
  }
];

// Obtener fuentes RSS con auto-reparación y diagnóstico Docker
function getSources() {
  try {
    if (fs.existsSync(SOURCES_FILE)) {
      const stats = fs.statSync(SOURCES_FILE);
      if (stats.isDirectory()) {
        console.error(`⚠️ ALERTA DOCKER: '${SOURCES_FILE}' se ha montado como un directorio en lugar de un archivo. Esto ocurre si no existía el archivo en el host de Synology antes del despliegue. Usando fuentes por defecto en memoria.`);
        return DEFAULT_SOURCES;
      }
      const data = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf-8'));
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (error) {
    console.error('Error leyendo sources.json:', error);
  }
  
  // Si no existe, está vacío o corrupto, intentar guardar y retornar por defecto
  try {
    const stats = fs.existsSync(SOURCES_FILE) ? fs.statSync(SOURCES_FILE) : null;
    if (!stats || !stats.isDirectory()) {
      fs.writeFileSync(SOURCES_FILE, JSON.stringify(DEFAULT_SOURCES, null, 2), 'utf-8');
    }
    return DEFAULT_SOURCES;
  } catch (e) {
    console.error('Error al guardar sources.json por defecto (posiblemente montado como directorio en Docker):', e.message);
    return DEFAULT_SOURCES;
  }
}

// Guardar fuentes RSS
function saveSources(sources) {
  try {
    fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('Error escribiendo sources.json:', error);
    return false;
  }
}

// --- Endpoints de la API ---

// 1. Obtener la lista de fuentes configuradas
app.get('/api/sources', (req, res) => {
  res.json(getSources());
});

// 2. Añadir/Actualizar fuentes
app.post('/api/sources', (req, res) => {
  const newSources = req.body;
  if (Array.isArray(newSources)) {
    if (saveSources(newSources)) {
      return res.json({ success: true, message: 'Fuentes actualizadas correctamente.' });
    }
  }
  res.status(400).json({ success: false, error: 'Formato inválido. Debe ser una lista de fuentes.' });
});

// 3. Scrapear las noticias de los diarios
app.get('/api/news', async (req, res) => {
  const sources = getSources();
  const aggregatedNews = [];

  const scrapePromises = sources.map(async (source) => {
    try {
      const feed = await parser.parseURL(source.url);
      feed.items.forEach(item => {
        aggregatedNews.push({
          sourceName: source.name,
          sourceCategory: source.category,
          title: item.title,
          link: item.link,
          pubDate: item.pubDate || item.isoDate,
          snippet: item.contentSnippet || item.description || ''
        });
      });
    } catch (error) {
      console.error(`Error scrapeando ${source.name} (${source.url}):`, error.message);
    }
  });

  await Promise.all(scrapePromises);

  // Orden por impacto en las últimas 24 h (cobertura entre diarios + frescura + temas clave); el resto, por fecha
  res.json(ordenarPorImpacto(aggregatedNews));
});

// 4. Guardar propuesta del día
app.post('/api/proposals', (req, res) => {
  const { date, postText, infographicData } = req.body;
  
  if (!date || !postText || !infographicData) {
    return res.status(400).json({ success: false, error: 'Datos de propuesta incompletos.' });
  }

  // Sanitizar fecha para evitar directory traversal (formato esperado YYYY-MM-DD)
  const safeDate = date.replace(/[^0-9-]/g, '');
  const proposalsDir = path.join(auth.getUserDir(req.user), 'proposals');
  const filePath = path.join(proposalsDir, `${safeDate}.json`);
  const latestPath = path.join(proposalsDir, 'latest.json');

  const proposalObj = {
    date: safeDate,
    updatedAt: new Date().toISOString(),
    postText,
    infographicData
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(proposalObj, null, 2), 'utf-8');
    fs.writeFileSync(latestPath, JSON.stringify(proposalObj, null, 2), 'utf-8');
    res.json({ success: true, message: 'Propuesta guardada correctamente.', date: safeDate });
  } catch (error) {
    console.error('Error guardando propuesta:', error);
    res.status(500).json({ success: false, error: 'No se pudo guardar la propuesta.' });
  }
});

// 5. Obtener última propuesta guardada
app.get('/api/proposals/latest', (req, res) => {
  const latestPath = path.join(auth.getUserDir(req.user), 'proposals', 'latest.json');
  try {
    if (fs.existsSync(latestPath)) {
      const data = JSON.parse(fs.readFileSync(latestPath, 'utf-8'));
      return res.json(data);
    }
    res.status(404).json({ success: false, message: 'No hay ninguna propuesta guardada todavía.' });
  } catch (error) {
    console.error('Error leyendo última propuesta:', error);
    res.status(500).json({ success: false, error: 'Error del servidor al leer la propuesta.' });
  }
});

// 6. Obtener propuesta de una fecha concreta
app.get('/api/proposals/:date', (req, res) => {
  const safeDate = req.params.date.replace(/[^0-9-]/g, '');
  const filePath = path.join(auth.getUserDir(req.user), 'proposals', `${safeDate}.json`);
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return res.json(data);
    }
    res.status(404).json({ success: false, message: `No hay propuesta para la fecha ${safeDate}.` });
  } catch (error) {
    console.error('Error leyendo propuesta:', error);
    res.status(500).json({ success: false, error: 'Error al leer la propuesta.' });
  }
});

// 6b. Probar la clave de Gemini (la que se escribe en el momento o, si no, la guardada del usuario)
app.post('/api/gemini-key/test', async (req, res) => {
  const typed = String(req.body.key || '').trim();
  const apiKey = typed || auth.getGeminiKey(req.user);
  const which = typed ? 'escrita' : 'guardada';
  if (!apiKey) {
    return res.status(400).json({ success: false, error: 'No hay ninguna clave que probar: escribe una o guárdala antes.' });
  }
  const model = /^[\w.\-]{1,60}$/.test(req.body.model || '') ? req.body.model : 'gemini-3.5-flash';
  try {
    const result = await new GoogleGenerativeAI(apiKey).getGenerativeModel({ model }).generateContent('Responde solo con la palabra OK');
    result.response.text();
    res.json({ success: true, model, which });
  } catch (error) {
    const detail = String(error.message || error).split(apiKey).join('***').slice(0, 300);
    res.status(400).json({ success: false, error: `La clave ${which} no ha funcionado con ${model}: ${detail}` });
  }
});

// Deja la infografía que devuelve la IA en un formato seguro: textos acotados, 3 datos, hasta 5 barras con longitud 4-100
function normalizarInfografia(info) {
  const t = (v, max) => String(v === undefined || v === null ? '' : v).trim().slice(0, max);
  const d = info && typeof info === 'object' ? info : {};
  const stats = (Array.isArray(d.stats) ? d.stats : []).slice(0, 3).map((x) => ({ value: t(x && x.value, 10), label: t(x && x.label, 28) }));
  const bars = (Array.isArray(d.bars) ? d.bars : []).slice(0, 5).map((b) => ({
    label: t(b && b.label, 18),
    value: t(b && b.value, 11),
    pct: Math.max(4, Math.min(100, Number(String(b && b.pct).replace(',', '.')) || 50))
  }));
  const icono = Array.from(t(d.icon, 16))[0] || '📊';
  const v = d.visual && typeof d.visual === 'object' ? d.visual : {};
  const visual = { apto: v.apto === true || String(v.apto).toLowerCase() === 'true', estilo: t(v.estilo, 30), imagePrompt: t(v.imagePrompt, 3500) };
  return { ...d, headline: t(d.headline, 80), category: t(d.category, 28), icon: icono, metric: t(d.metric, 12), metricSub: t(d.metricSub, 36),
    visual, ctxText: t(d.ctxText, 190), stats, barsTitle: t(d.barsTitle, 44), bars, takeaway: t(d.takeaway, 120),
    mkt1Name: t(d.mkt1Name, 18), mkt2Name: t(d.mkt2Name, 18), mkt3Name: t(d.mkt3Name, 18) };
}

// 7. Generar propuesta bajo demanda utilizando la API oficial de Gemini (JSON estructurado)
app.post('/api/proposals/generate', async (req, res) => {
  const { title, snippet, sourceName, model: requestedModel } = req.body;
  // Cada usuario usa su propia clave de Gemini, guardada cifrada en su cuenta
  const apiKey = auth.getGeminiKey(req.user);

  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: 'Falta tu clave API de Gemini. Añádela en tu perfil (menú de usuario → Mi perfil).'
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: /^[\w.\-]{1,60}$/.test(requestedModel || '') ? requestedModel : 'gemini-3.5-flash',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    }, process.env.GEMINI_BASE_URL ? { baseUrl: process.env.GEMINI_BASE_URL } : undefined);   // GEMINI_BASE_URL: solo para pruebas

    const prompt = `
      Eres un economista profesional, experto en comunicación y redacción corporativa de alto impacto para LinkedIn.
      Tu objetivo es analizar la siguiente noticia económica española y generar:
      1. Un post para LinkedIn redactado en español. Debe tener un gancho impactante, ser muy fácil de leer (usando párrafos cortos y listas numeradas con emojis), contener emojis discretos y profesionales, y terminar con una pregunta de debate para fomentar la interacción y comentarios de otros profesionales. Al final del post debes incluir la atribución exacta en una línea: "Creado por http://mafede.i234.me con ayuda de Gemini".
      2. Los datos estructurados para una infografía corporativa en formato vertical de alta resolución (1080x1350 px) que resuma de forma extremadamente visual la noticia.
      
      Noticia a analizar:
      - Título: ${title}
      - Descripción: ${snippet}
      - Fuente de origen: ${sourceName}
      
      ADEMÁS actúas como DIRECTOR DE ARTE de infografías para LinkedIn. Las mejores infografías (las que busca el usuario) son IMÁGENES completas, densas y muy visuales, hechas por un modelo de imagen, con estos estilos:
        - "escenarios": 3 o 4 tarjetas de colores que comparan escenarios con cifras enormes (p. ej. sueldo bruto 25.000 / 50.000 / 75.000 € y cuánto queda neto), con barra de progreso, iconos, un elemento central ilustrado y un bloque final de contexto.
        - "ranking": titular y cifra clave gigantes + ranking ordenado con barras de colores (de rojo a azul/verde), números grandes, banderas o escudos, medallas y pictogramas por tramo.
        - "mapa": mapa ilustrado del país o la región con cada zona coloreada por su valor y el dato dentro, más un ranking lateral con puntos de color, tres tarjetas de mínimo/media/máximo y una leyenda.
        - "kpi-ilustracion": cifra enorme (KPI) al lado de una ilustración 3D del tema (un escudo con banderas, lingotes, monedas de oro, una copa, un edificio...), barras de antes/después con dibujos (barcos, fábricas, rollos de acero...) y dos columnas «pros» y «contras» con iconos.
        - "retratos": ranking con avatares ilustrados de las personas implicadas, escudos de equipos o empresas, banderas, tipos y cifras netas; siempre ilustraciones originales, nunca fotografías de personas reales.
        - "dashboard": 3 o 4 paneles numerados con pirámides de población, gráficos de barras y líneas, balanzas, flechas y esquemas que cuentan una causa y su consecuencia, con una solución destacada abajo.
        - "tabla-pictogramas": tabla limpia con filas por tramos, pictogramas de personas proporcionales, porcentajes y una caja «para reflexionar».
        - "arbol": diagrama de flujo / árbol de decisión con cajas de colores, flechas y ejemplos.
        - "ninguno": la noticia NO se presta (no hay cifras comparables ni nada que dibujar: nombramientos, declaraciones, opiniones...). Sé honesto: es mejor «ninguno» que una infografía vacía.
      Elige el estilo que mejor encaje con la noticia y rellena "visual":
        - "apto": true si la noticia se presta a una infografía así; false si no.
        - "estilo": uno de los nombres anteriores.
        - "imagePrompt": instrucciones COMPLETAS para el modelo de imagen, en español, de 900 a 1800 caracteres, que describan: formato vertical 4:5 (1080x1350), la paleta (rojo/granate para alertas, verde/azul para crecimiento, azul marino y dorado para mercados), la estructura de arriba abajo, TODOS los textos y cifras EXACTOS que deben aparecer (titular, cifras, etiquetas, tramos, conclusión) entre comillas, las ilustraciones/dibujos/iconos/mapas concretos de cada zona, y que al pie aparezca en letra pequeña: "Creado por https://mafede.i234.me con ayuda de Gemini". Exige tipografía muy grande, nítida, con alto contraste y ortografía perfecta en español, sin texto inventado ni garabatos.
      Usa solo cifras que aparezcan en la noticia o que sean datos públicos fiables; no inventes datos.

      La infografía debe tener MÁXIMO IMPACTO VISUAL: una cifra gigante, tres datos clave y un gráfico de barras comparativo (de 3 a 5 barras) que haga ver la magnitud de un vistazo (países, escenarios, antes/después, ranking...). Usa solo cifras que aparezcan en la noticia o que sean datos públicos fiables; si no tienes datos comparables, compara magnitudes de la propia noticia y NO inventes cifras. Respeta los límites de caracteres: los textos largos se recortan.

      Debes responder ÚNICAMENTE con un objeto JSON con el siguiente esquema estricto de campos:
      {
        "postText": "Texto completo del post de LinkedIn listo para copiar y pegar...",
        "infographicData": {
          "headline": "Titular en mayúsculas, directo y con gancho (máximo 60 caracteres)",
          "category": "Categoría en mayúsculas (máx. 24 caracteres; ej. MACROECONOMÍA, INFLACIÓN, MERCADOS, REGULACIÓN)",
          "icon": "UN solo emoji que represente el tema (ej. 📉 🛢️ 🏦 🛡️ 💶)",
          "sentiment": true (boolean: true si la noticia es positiva o de crecimiento, false si es de alerta o riesgo),
          "metric": "LA cifra clave, corta y llamativa, máximo 9 caracteres (ej. '50%', '3,0%', '126.700 M€', '+2,4%')",
          "metricSub": "Qué representa la cifra, en mayúsculas (máximo 32 caracteres)",
          "ctxText": "Contexto en 1 o 2 frases (máximo 150 caracteres)",
          "stats": [
            { "value": "Dato corto (máx. 8 caracteres, ej. '+2,1 pp', '1945', '-30%')", "label": "Qué es, en minúsculas (máx. 24 caracteres)" },
            { "value": "...", "label": "..." },
            { "value": "...", "label": "..." }
          ],
          "barsTitle": "Título del gráfico de barras en mayúsculas (máx. 40 caracteres, ej. 'DEUDA SOBRE EL PIB POR PAÍS')",
          "bars": [
            { "label": "Nombre corto (máx. 16 caracteres)", "value": "Valor con su unidad (máx. 9 caracteres, ej. '230%', '24 ago', '236 días')", "pct": "número de 10 a 100: longitud de la barra, proporcional al valor (la mayor = 100)" }
          ],
          "bullet1": "Primera clave. Empieza con una palabra en negrita (ej: '<strong>Consumo:</strong> detalle...'). Máximo 85 caracteres.",
          "bullet2": "Segunda clave, también con negrita. Máximo 85 caracteres.",
          "bullet3": "Tercera clave, también con negrita. Máximo 85 caracteres.",
          "mkt1Name": "Mercado o sector 1 (máximo 14 caracteres)",
          "mkt1Trend": "up, down, o neutral (según cómo impacte la noticia)",
          "mkt2Name": "Mercado o sector 2 (máximo 14 caracteres)",
          "mkt2Trend": "up, down, o neutral",
          "mkt3Name": "Mercado o sector 3 (máximo 14 caracteres)",
          "mkt3Trend": "up, down, o neutral",
          "takeaway": "Conclusión contundente en una frase (máximo 100 caracteres)",
          "visual": { "apto": true, "estilo": "uno de los estilos anteriores", "imagePrompt": "instrucciones completas para el modelo de imagen (900-1800 caracteres)" },
          "sourceText": "Fuente: ${sourceName} y diarios económicos españoles | ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}"
        }
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const proposalData = JSON.parse(responseText);
    proposalData.infographicData = normalizarInfografia(proposalData.infographicData);

    // Guardar automáticamente en proposals/latest.json y en el historial diario YYYY-MM-DD.json
    const proposalsDir = path.join(auth.getUserDir(req.user), 'proposals');
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeDate = dateStr.replace(/[^0-9-]/g, '');
    
    const filePath = path.join(proposalsDir, `${safeDate}.json`);
    const latestPath = path.join(proposalsDir, 'latest.json');

    const proposalObj = {
      date: safeDate,
      updatedAt: new Date().toISOString(),
      postText: proposalData.postText,
      infographicData: proposalData.infographicData
    };

    fs.writeFileSync(filePath, JSON.stringify(proposalObj, null, 2), 'utf-8');
    fs.writeFileSync(latestPath, JSON.stringify(proposalObj, null, 2), 'utf-8');
    for (const e of ['png', 'jpg', 'webp']) fs.rmSync(path.join(proposalsDir, `latest_image.${e}`), { force: true });   // la imagen anterior ya no corresponde

    res.json({ success: true, proposal: proposalObj });

  } catch (error) {
    console.error('Error generando propuesta con Gemini:', error);
    res.status(500).json({ success: false, error: 'Error interno en la generación de la IA: ' + error.message });
  }
});

// 8. Infografía como imagen generada por la IA (trabajo en segundo plano: tarda de 20 a 90 s)
const trabajosImagen = new Map();   // id -> { userId, estado: 'en curso' | 'listo' | 'error', error, inicio }
const IMAGEN_PRO = 'gemini-3-pro-image-preview';

function carpetaPropuestas(user) { return path.join(auth.getUserDir(user), 'proposals'); }
function ficheroImagen(user) {
  const dir = carpetaPropuestas(user);
  const f = ['png', 'jpg', 'webp'].map((e) => path.join(dir, `latest_image.${e}`)).find((x) => fs.existsSync(x));
  return f || null;
}

app.post('/api/infographic/image', (req, res) => {
  const apiKey = auth.getGeminiKey(req.user);
  if (!apiKey) return res.status(400).json({ success: false, error: 'Falta tu clave API de Gemini. Añádela en tu perfil (menú de usuario → Mi perfil).' });
  const enCurso = [...trabajosImagen.values()].find((j) => j.userId === req.user.id && j.estado === 'en curso' && Date.now() - j.inicio < 300000);
  if (enCurso) return res.status(409).json({ success: false, error: 'Ya hay una imagen generándose; espera a que termine.' });

  const model = /^[\w.\-]{1,60}$/.test(req.body.model || '') ? req.body.model : IMAGEN_PRO;
  let prompt = String(req.body.prompt || '').trim().slice(0, 4000);
  if (!prompt) prompt = imagen.construirPromptImagen(req.body.infographicData || {});
  if (!prompt.includes('mafede.i234.me')) prompt += `\nAl pie, en letra pequeña: "${imagen.FIRMA}".`;

  const id = crypto.randomBytes(8).toString('hex');
  const trabajo = { userId: req.user.id, estado: 'en curso', error: null, inicio: Date.now() };
  trabajosImagen.set(id, trabajo);
  for (const [k, j] of trabajosImagen) if (Date.now() - j.inicio > 1800000) trabajosImagen.delete(k);   // limpieza a los 30 min

  imagen.generarImagen(apiKey, model, prompt).then(({ mime, data }) => {
    const dir = carpetaPropuestas(req.user);
    for (const e of ['png', 'jpg', 'webp']) fs.rmSync(path.join(dir, `latest_image.${e}`), { force: true });
    const ext = imagen.extDe(mime);
    fs.writeFileSync(path.join(dir, `latest_image.${ext}`), data);
    fs.writeFileSync(path.join(dir, `${new Date().toISOString().slice(0, 10)}_image.${ext}`), data);
    trabajo.estado = 'listo';
  }).catch((e) => {
    console.error('Error generando la imagen:', String(e.message).slice(0, 200));
    trabajo.estado = 'error';
    trabajo.error = String(e.message || e).slice(0, 300);
  });
  res.json({ success: true, id, model });
});

app.get('/api/infographic/job/:id', (req, res) => {
  const j = trabajosImagen.get(req.params.id);
  if (!j || j.userId !== req.user.id) return res.status(404).json({ success: false, error: 'Trabajo no encontrado' });
  res.json({ success: true, estado: j.estado, error: j.error, segundos: Math.round((Date.now() - j.inicio) / 1000) });
});

app.get('/api/infographic/image', (req, res) => {
  const f = ficheroImagen(req.user);
  if (!f) return res.status(404).json({ success: false, error: 'Todavía no hay imagen generada.' });
  res.set('Cache-Control', 'no-store');
  res.sendFile(f);
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de automatización LinkedIn escuchando en http://localhost:${PORT}`);
});
