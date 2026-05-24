const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

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

// Rutas de archivos
const SOURCES_FILE = path.join(__dirname, 'sources.json');
const PROPOSALS_DIR = path.join(__dirname, 'proposals');

// Asegurar que exista la carpeta de propuestas
if (!fs.existsSync(PROPOSALS_DIR)) {
  fs.mkdirSync(PROPOSALS_DIR);
}

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

  // Ordenar por fecha si está disponible (de más reciente a más antiguo)
  aggregatedNews.sort((a, b) => {
    const dateA = a.pubDate ? new Date(a.pubDate) : new Date(0);
    const dateB = b.pubDate ? new Date(b.pubDate) : new Date(0);
    return dateB - dateA;
  });

  res.json(aggregatedNews);
});

// 4. Guardar propuesta del día
app.post('/api/proposals', (req, res) => {
  const { date, postText, infographicData } = req.body;
  
  if (!date || !postText || !infographicData) {
    return res.status(400).json({ success: false, error: 'Datos de propuesta incompletos.' });
  }

  // Sanitizar fecha para evitar directory traversal (formato esperado YYYY-MM-DD)
  const safeDate = date.replace(/[^0-9-]/g, '');
  const filePath = path.join(PROPOSALS_DIR, `${safeDate}.json`);
  const latestPath = path.join(PROPOSALS_DIR, 'latest.json');

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
  const latestPath = path.join(PROPOSALS_DIR, 'latest.json');
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
  const filePath = path.join(PROPOSALS_DIR, `${safeDate}.json`);
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

// 7. Generar propuesta bajo demanda utilizando la API oficial de Gemini (JSON estructurado)
app.post('/api/proposals/generate', async (req, res) => {
  const { title, snippet, sourceName } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(400).json({
      success: false,
      error: 'Clave API de Gemini ausente. Por favor, añade tu clave API de Gemini en la variable GEMINI_API_KEY dentro de tu panel de Portainer (como variable de entorno) o en un archivo .env.'
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const prompt = `
      Eres un economista profesional, experto en comunicación y redacción corporativa de alto impacto para LinkedIn.
      Tu objetivo es analizar la siguiente noticia económica española y generar:
      1. Un post para LinkedIn redactado en español. Debe tener un gancho impactante, ser muy fácil de leer (usando párrafos cortos y listas numeradas con emojis), contener emojis discretos y profesionales, y terminar con una pregunta de debate para fomentar la interacción y comentarios de otros profesionales. Al final del post debes incluir la atribución exacta en una línea: "Creado por http://mafede.i234.me con ayuda de Gemini".
      2. Los datos estructurados para una infografía corporativa en formato vertical de alta resolución (1080x1350 px) que resuma de forma extremadamente visual la noticia.
      
      Noticia a analizar:
      - Título: ${title}
      - Descripción: ${snippet}
      - Fuente de origen: ${sourceName}
      
      Debes responder ÚNICAMENTE con un objeto JSON con el siguiente esquema estricto de campos:
      {
        "postText": "Texto completo del post de LinkedIn listo para copiar y pegar...",
        "infographicData": {
          "headline": "Titular de la infografía en mayúsculas (máximo 65 caracteres)",
          "category": "Categoría general (ej. MACROECONOMÍA, INFLACIÓN, MERCADOS, REGULACIÓN)",
          "sentiment": true (boolean: true si la noticia es positiva o de crecimiento, false si es de alerta o riesgo),
          "metric": "Una métrica numérica clave muy llamativa con su símbolo, bien grande (ej. '+2,4% PIB', '3,0% IPC', '126.700 M€')",
          "metricSub": "Breve descripción de qué representa esa métrica (máximo 40 caracteres en mayúsculas)",
          "ctxText": "Un párrafo de contexto histórico o explicativo de 2 o 3 líneas (máximo 250 caracteres)",
          "bullet1": "Primer dato o riesgo clave. Comienza con una palabra en negrita (ej: '<strong>Consumo:</strong> Detalle del dato...'). Máximo 100 caracteres.",
          "bullet2": "Segundo dato o riesgo clave. Comienza con negrita.",
          "bullet3": "Tercer dato o riesgo clave. Comienza con negrita.",
          "mkt1Name": "Nombre del mercado 1 (ej. Renta Variable / IBEX 35)",
          "mkt1Trend": "up, down, o neutral (según cómo impacte la noticia)",
          "mkt2Name": "Nombre del mercado 2 (ej. Deuda / Bono 10Y)",
          "mkt2Trend": "up, down, o neutral",
          "mkt3Name": "Nombre del mercado 3 (ej. Euro / Divisas o Petróleo / Brent)",
          "mkt3Trend": "up, down, o neutral",
          "sourceText": "Fuente: ${sourceName} y diarios económicos españoles | Mayo 2026"
        }
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const proposalData = JSON.parse(responseText);

    // Guardar automáticamente en proposals/latest.json y en el historial diario YYYY-MM-DD.json
    const dateStr = new Date().toISOString().slice(0, 10);
    const safeDate = dateStr.replace(/[^0-9-]/g, '');
    
    const filePath = path.join(PROPOSALS_DIR, `${safeDate}.json`);
    const latestPath = path.join(PROPOSALS_DIR, 'latest.json');

    const proposalObj = {
      date: safeDate,
      updatedAt: new Date().toISOString(),
      postText: proposalData.postText,
      infographicData: proposalData.infographicData
    };

    fs.writeFileSync(filePath, JSON.stringify(proposalObj, null, 2), 'utf-8');
    fs.writeFileSync(latestPath, JSON.stringify(proposalObj, null, 2), 'utf-8');

    res.json({ success: true, proposal: proposalObj });

  } catch (error) {
    console.error('Error generando propuesta con Gemini:', error);
    res.status(500).json({ success: false, error: 'Error interno en la generación de la IA: ' + error.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de automatización LinkedIn escuchando en http://localhost:${PORT}`);
});
