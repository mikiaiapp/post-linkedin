const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

const parser = new Parser({
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
});

const SOURCES_FILE = path.join(__dirname, 'sources.json');
const OUTPUT_FILE = path.join(__dirname, 'proposals', 'today_news.json');

async function scrape() {
  console.log('Iniciando escaneo de prensa económica...');
  
  if (!fs.existsSync(SOURCES_FILE)) {
    console.error('No se encontró el archivo sources.json.');
    process.exit(1);
  }

  const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf-8'));
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
