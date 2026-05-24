const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3080;
const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
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

// Obtener fuentes RSS
function getSources() {
  try {
    if (fs.existsSync(SOURCES_FILE)) {
      return JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error leyendo sources.json:', error);
  }
  return [];
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

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de automatización LinkedIn escuchando en http://localhost:${PORT}`);
});
