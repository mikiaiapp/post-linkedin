// ==========================================================================
// LÓGICA DE CONTROL - DASHBOARD POSTLINKEDIN
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  
  // --- Elementos del DOM ---
  const canvas = document.getElementById('infographic-canvas-element');
  const viewport = canvas.parentElement;
  
  // Inputs del editor de infografía
  const inputHeadline = document.getElementById('info-headline');
  const inputCategory = document.getElementById('info-category');
  const inputMetric = document.getElementById('info-metric');
  const inputSentiment = document.getElementById('info-sentiment');
  const inputBullet1 = document.getElementById('info-bullet-1');
  const inputBullet2 = document.getElementById('info-bullet-2');
  const inputBullet3 = document.getElementById('info-bullet-3');
  
  // Elementos de la infografía (canvas)
  const canvasTag = document.getElementById('canvas-tag');
  const canvasTitle = document.getElementById('canvas-title-text');
  const canvasMetric = document.getElementById('canvas-metric-value');
  const canvasBullet1 = document.getElementById('canvas-bullet-1-text');
  const canvasBullet2 = document.getElementById('canvas-bullet-2-text');
  const canvasBullet3 = document.getElementById('canvas-bullet-3-text');
  
  // Post de LinkedIn
  const postTextarea = document.getElementById('linkedin-post-textarea');
  const charCount = document.getElementById('char-count');
  const postSentimentIndicator = document.getElementById('post-sentiment-indicator');
  
  // Botones
  const btnSyncNews = document.getElementById('btn-sync-news');
  const btnCopyPost = document.getElementById('btn-copy-post');
  const btnSaveProposal = document.getElementById('btn-save-proposal');
  const btnDownloadInfo = document.getElementById('btn-download-infographic');
  
  // Feeds RSS y Noticias
  const scrapedNewsList = document.getElementById('scraped-news-list');
  const newsCountBadge = document.getElementById('news-count-badge');
  const activeSourcesList = document.getElementById('active-sources-list');
  const newSourceName = document.getElementById('new-source-name');
  const newSourceUrl = document.getElementById('new-source-url');
  const btnAddSource = document.getElementById('btn-add-source');

  // --- 1. Escalado del lienzo de infografía (1080x1350) ---
  function scaleCanvas() {
    const scaleX = viewport.clientWidth / 1080;
    const scaleY = viewport.clientHeight / 1350;
    const scale = Math.min(scaleX, scaleY);
    canvas.style.transform = `scale(${scale})`;
  }
  
  // Escalado responsivo inicial y al redimensionar
  scaleCanvas();
  window.addEventListener('resize', scaleCanvas);
  
  // Un pequeño truco para volver a calibrar el escalado tras unos ms si la UI flex se ajusta
  setTimeout(scaleCanvas, 300);

  // --- 2. Sincronización en tiempo real (Inputs -> Canvas) ---
  function syncInput(inputEl, canvasEl, maxLength = 250) {
    inputEl.addEventListener('input', () => {
      canvasEl.textContent = inputEl.value || '...';
      // Ajustar escala en caso de cambios de tamaño dinámicos
      scaleCanvas();
    });
  }

  syncInput(inputHeadline, canvasTitle);
  syncInput(inputCategory, canvasTag);
  syncInput(inputMetric, canvasMetric);
  syncInput(inputBullet1, canvasBullet1);
  syncInput(inputBullet2, canvasBullet2);
  syncInput(inputBullet3, canvasBullet3);

  // Sincronización de Sentimiento / Tema
  inputSentiment.addEventListener('change', () => {
    updateSentimentTheme(inputSentiment.checked);
  });

  function updateSentimentTheme(isPositive) {
    if (isPositive) {
      canvas.classList.remove('sentiment-negative');
      canvas.classList.add('sentiment-positive');
      postSentimentIndicator.textContent = 'Noticia Positiva';
      postSentimentIndicator.className = 'sentiment-indicator positive';
    } else {
      canvas.classList.remove('sentiment-positive');
      canvas.classList.add('sentiment-negative');
      postSentimentIndicator.textContent = 'Noticia Negativa';
      postSentimentIndicator.className = 'sentiment-indicator negative';
    }
  }

  // Contador de caracteres del post
  postTextarea.addEventListener('input', () => {
    charCount.textContent = postTextarea.value.length;
  });

  // --- 3. Copiar Post de LinkedIn al portapapeles ---
  btnCopyPost.addEventListener('click', () => {
    postTextarea.select();
    document.execCommand('copy');
    
    // Feedback visual temporal en el botón
    const originalText = btnCopyPost.innerHTML;
    btnCopyPost.innerHTML = '<span class="btn-icon">✅</span> ¡Copiado!';
    btnCopyPost.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
    
    setTimeout(() => {
      btnCopyPost.innerHTML = originalText;
      btnCopyPost.style.background = '';
    }, 2000);
  });

  // --- 4. Descargar Infografía como PNG de Alta Calidad (1080x1350) ---
  btnDownloadInfo.addEventListener('click', () => {
    // 1. Quitar escalado CSS temporalmente para evitar pixelación
    canvas.style.transform = 'none';
    
    // 2. Ejecutar html2canvas con dimensiones fijas exactas 1080x1350
    html2canvas(canvas, {
      width: 1080,
      height: 1350,
      scale: 1, // Escala de imagen final (1 = 1080x1350 exacta)
      useCORS: true,
      allowTaint: true,
      backgroundColor: null
    }).then(imageCanvas => {
      // 3. Restaurar el escalado de visualización
      scaleCanvas();
      
      // 4. Crear enlace de descarga
      const imageURL = imageCanvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      
      // Formatear nombre de descarga con la fecha
      const dateStr = new Date().toISOString().slice(0, 10);
      const headlineSnippet = inputHeadline.value
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 30);
      
      downloadLink.download = `infografia_${dateStr}_${headlineSnippet}.png`;
      downloadLink.href = imageURL;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }).catch(error => {
      console.error('Error al generar la infografía:', error);
      scaleCanvas();
      alert('Hubo un error al generar la imagen. Inténtalo de nuevo.');
    });
  });

  // --- 5. Consumo de API del Servidor ---

  const API_BASE = ''; // Relativo al host actual

  // Cargar fuentes RSS activas
  async function loadSources() {
    try {
      const response = await fetch(`${API_BASE}/api/sources`);
      const sources = await response.json();
      
      activeSourcesList.innerHTML = '';
      sources.forEach((source, index) => {
        const item = document.createElement('div');
        item.className = 'source-tag';
        item.innerHTML = `
          <div>
            <span class="source-tag-name">${source.name}</span>
            <span class="source-tag-url">${source.url}</span>
          </div>
          <button class="btn-remove-source" data-index="${index}" title="Eliminar fuente">&times;</button>
        `;
        activeSourcesList.appendChild(item);
      });

      // Añadir eventos para eliminar
      document.querySelectorAll('.btn-remove-source').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const index = parseInt(e.target.getAttribute('data-index'));
          sources.splice(index, 1);
          await saveSourcesList(sources);
        });
      });

    } catch (error) {
      console.error('Error cargando fuentes RSS:', error);
    }
  }

  // Guardar lista de fuentes
  async function saveSourcesList(sources) {
    try {
      const response = await fetch(`${API_BASE}/api/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sources)
      });
      if (response.ok) {
        loadSources();
      }
    } catch (error) {
      console.error('Error guardando fuentes RSS:', error);
    }
  }

  // Añadir nueva fuente RSS
  btnAddSource.addEventListener('click', async () => {
    const name = newSourceName.value.trim();
    const url = newSourceUrl.value.trim();
    
    if (!name || !url) {
      alert('Por favor, rellena el nombre y la URL del feed RSS.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/sources`);
      const sources = await response.json();
      sources.push({ name, url, category: 'Personalizada' });
      
      await saveSourcesList(sources);
      
      newSourceName.value = '';
      newSourceUrl.value = '';
    } catch (error) {
      console.error('Error añadiendo fuente RSS:', error);
    }
  });

  // Cargar y escudriñar noticias económicas
  async function syncAndLoadNews() {
    scrapedNewsList.innerHTML = `
      <div class="loading-state">
        <span class="spinner">⏳</span>
        <p>Scrapeando portadas de la prensa económica española en vivo...</p>
      </div>
    `;
    newsCountBadge.textContent = 'Cargando...';

    try {
      const response = await fetch(`${API_BASE}/api/news`);
      const news = await response.json();
      
      scrapedNewsList.innerHTML = '';
      newsCountBadge.textContent = `${news.length} noticias`;

      if (news.length === 0) {
        scrapedNewsList.innerHTML = '<p class="section-desc">No se encontraron noticias. Revisa los feeds RSS.</p>';
        return;
      }

      news.forEach(item => {
        const card = document.createElement('div');
        card.className = 'news-item';
        card.innerHTML = `
          <div class="news-item-header">
            <span class="news-item-source">${item.sourceName}</span>
            <span class="news-item-date">${item.pubDate ? new Date(item.pubDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Hoy'}</span>
          </div>
          <h3 class="news-item-title">${item.title}</h3>
          <p class="news-item-snippet">${item.snippet}</p>
        `;
        
        // Al hacer clic en una noticia, ayudar a rellenar el editor rápidamente por si el usuario quiere cambiar
        card.addEventListener('click', () => {
          if (confirm(`¿Quieres utilizar el titular "${item.title}" para tu infografía de hoy? (Esto sustituirá los textos actuales del editor)`)) {
            inputHeadline.value = item.title;
            canvasTitle.textContent = item.title;
            inputCategory.value = item.sourceCategory.toUpperCase();
            canvasTag.textContent = item.sourceCategory.toUpperCase();
            scaleCanvas();
          }
        });
        
        scrapedNewsList.appendChild(card);
      });

    } catch (error) {
      console.error('Error sincronizando noticias:', error);
      scrapedNewsList.innerHTML = '<p class="section-desc">Ocurrió un error al obtener las noticias del servidor.</p>';
      newsCountBadge.textContent = 'Error';
    }
  }

  btnSyncNews.addEventListener('click', syncAndLoadNews);

  // Guardar propuesta actual
  btnSaveProposal.addEventListener('click', async () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    const proposal = {
      date: dateStr,
      postText: postTextarea.value,
      infographicData: {
        headline: inputHeadline.value,
        category: inputCategory.value,
        sentiment: inputSentiment.checked,
        metric: inputMetric.value,
        bullet1: inputBullet1.value,
        bullet2: inputBullet2.value,
        bullet3: inputBullet3.value
      }
    };

    try {
      const response = await fetch(`${API_BASE}/api/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proposal)
      });
      const resData = await response.json();
      if (resData.success) {
        alert('¡Propuesta guardada correctamente en el historial!');
      } else {
        alert('Error: ' + resData.error);
      }
    } catch (error) {
      console.error('Error guardando propuesta:', error);
      alert('Error de conexión al guardar la propuesta.');
    }
  });

  // Cargar propuesta del día (si existe en el servidor)
  async function loadLatestProposal() {
    try {
      const response = await fetch(`${API_BASE}/api/proposals/latest`);
      if (response.ok) {
        const data = await response.json();
        
        // Rellenar post
        postTextarea.value = data.postText;
        charCount.textContent = postTextarea.value.length;
        
        // Rellenar inputs de la infografía
        const info = data.infographicData;
        inputHeadline.value = info.headline || '';
        inputCategory.value = info.category || '';
        inputSentiment.checked = info.sentiment !== undefined ? info.sentiment : true;
        inputMetric.value = info.metric || '';
        inputBullet1.value = info.bullet1 || '';
        inputBullet2.value = info.bullet2 || '';
        inputBullet3.value = info.bullet3 || '';
        
        // Sincronizar Canvas
        canvasTitle.textContent = info.headline || '...';
        canvasTag.textContent = info.category || '...';
        canvasMetric.textContent = info.metric || '...';
        canvasBullet1.textContent = info.bullet1 || '...';
        canvasBullet2.textContent = info.bullet2 || '...';
        canvasBullet3.textContent = info.bullet3 || '...';
        
        updateSentimentTheme(inputSentiment.checked);
        scaleCanvas();
      }
    } catch (error) {
      console.warn('No hay propuesta diaria previa o servidor apagado.');
    }
  }

  // --- 6. Inicialización ---
  loadSources();
  loadLatestProposal();
  syncAndLoadNews();

  // Actualizar la etiqueta de fecha del header
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('current-date-badge').textContent = new Date().toLocaleDateString('es-ES', options);

});
