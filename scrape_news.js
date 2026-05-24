const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  requestOptions: {
    rejectUnauthorized: false
  }
});

const SOURCES_FILE = path.join(__dirname, 'sources.json');
const OUTPUT_FILE = path.join(__dirname, 'proposals', 'today_news.json');

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

function getSources() {
  try {
    if (fs.existsSync(SOURCES_FILE)) {
      const stats = fs.statSync(SOURCES_FILE);
      if (stats.isDirectory()) {
        console.error(`⚠️ ALERTA DOCKER (cron): '${SOURCES_FILE}' se ha montado como un directorio en lugar de un archivo. Usando fuentes por defecto.`);
        return DEFAULT_SOURCES;
      }
      const data = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf-8'));
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (error) {
    console.error('Error leyendo sources.json en cron:', error);
  }
  return DEFAULT_SOURCES;
}

async function scrape() {
  console.log('Iniciando escaneo de prensa económica (Cron)...');
  
  const sources = getSources();
  const aggregatedNews = [];

  for (const source of sources) {
    try {
      console.log(`Scrapeando: ${source.name}...`);
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
      console.error(`Error en ${source.name}: ${error.message}`);
    }
  }

  // Ordenar por fecha
  aggregatedNews.sort((a, b) => {
    const dateA = a.pubDate ? new Date(a.pubDate) : new Date(0);
    const dateB = b.pubDate ? new Date(b.pubDate) : new Date(0);
    return dateB - dateA;
  });

  // Asegurar que la carpeta de destino existe
  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(aggregatedNews, null, 2), 'utf-8');
  console.log(`¡Escaneo completado! Se han guardado ${aggregatedNews.length} noticias en ${OUTPUT_FILE}`);
}

scrape();
