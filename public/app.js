// ==========================================================================
// LÓGICA DE CONTROL AVANZADA - DASHBOARD POSTLINKEDIN
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  
  // --- Elementos del DOM ---
  const canvas = document.getElementById('infographic-canvas-element');
  const viewport = canvas.parentElement;
  
  // Inputs del editor de infografía
  const inputHeadline = document.getElementById('info-headline');
  const inputCategory = document.getElementById('info-category');
  const inputMetric = document.getElementById('info-metric');
  const inputMetricSub = document.getElementById('info-metric-sub');
  const inputSentiment = document.getElementById('info-sentiment');
  
  const inputCtxText = document.getElementById('info-ctx-text');
  
  const inputBullet1 = document.getElementById('info-bullet-1');
  const inputBullet2 = document.getElementById('info-bullet-2');
  const inputBullet3 = document.getElementById('info-bullet-3');
  
  const inputMkt1Name = document.getElementById('info-mkt-1-name');
  const inputMkt1Trend = document.getElementById('info-mkt-1-trend');
  
  const inputMkt2Name = document.getElementById('info-mkt-2-name');
  const inputMkt2Trend = document.getElementById('info-mkt-2-trend');
  
  const inputMkt3Name = document.getElementById('info-mkt-3-name');
  const inputMkt3Trend = document.getElementById('info-mkt-3-trend');
  
  const inputSource = document.getElementById('info-source');

  // Configuración de la IA
  const inputAIModel = document.getElementById('info-ai-model');
  const inputAIModelCustom = document.getElementById('info-ai-model-custom');
  const customModelGroup = document.getElementById('custom-model-group');

  // Elementos de la infografía (canvas)
  const canvasTag = document.getElementById('canvas-tag');
  const canvasTitle = document.getElementById('canvas-title-text');
  const canvasMetric = document.getElementById('canvas-metric-value');
  const canvasMetricSub = document.getElementById('canvas-metric-sub');
  
  const canvasCtxText = document.getElementById('canvas-ctx-text');
  
  const canvasBullet1 = document.getElementById('canvas-bullet-1-text');
  const canvasBullet2 = document.getElementById('canvas-bullet-2-text');
  const canvasBullet3 = document.getElementById('canvas-bullet-3-text');
  
  const canvasMkt1Name = document.getElementById('canvas-mkt-1-name');
  const canvasMkt1Badge = document.getElementById('canvas-mkt-1-badge');
  
  const canvasMkt2Name = document.getElementById('canvas-mkt-2-name');
  const canvasMkt2Badge = document.getElementById('canvas-mkt-2-badge');
  
  const canvasMkt3Name = document.getElementById('canvas-mkt-3-name');
  const canvasMkt3Badge = document.getElementById('canvas-mkt-3-badge');
  
  const canvasFooterSource = document.getElementById('canvas-footer-source');
  
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
  setTimeout(scaleCanvas, 300);

  // --- 2. Sincronización en tiempo real (Inputs -> Canvas) ---
  function syncInput(inputEl, canvasEl) {
    if (inputEl && canvasEl) {
      inputEl.addEventListener('input', () => {
        canvasEl.textContent = inputEl.value || '...';
        scaleCanvas();
      });
    }
  }

  syncInput(inputHeadline, canvasTitle);
  syncInput(inputCategory, canvasTag);
  syncInput(inputMetric, canvasMetric);
  syncInput(inputMetricSub, canvasMetricSub);
  syncInput(inputCtxText, canvasCtxText);
  syncInput(inputBullet1, canvasBullet1);
  syncInput(inputBullet2, canvasBullet2);
  syncInput(inputBullet3, canvasBullet3);
  syncInput(inputMkt1Name, canvasMkt1Name);
  syncInput(inputMkt2Name, canvasMkt2Name);
  syncInput(inputMkt3Name, canvasMkt3Name);
  syncInput(inputSource, canvasFooterSource);

  // Sincronización de badges de tendencia
  function syncTrendBadge(selectEl, badgeEl) {
    if (selectEl && badgeEl) {
      selectEl.addEventListener('change', () => {
        updateTrendBadgeUI(selectEl.value, badgeEl);
      });
    }
  }

  function updateTrendBadgeUI(value, badgeEl) {
    badgeEl.className = 'market-badge'; // Reset
    if (value === 'up') {
      badgeEl.classList.add('trend-up');
      badgeEl.innerHTML = '<span class="trend-icon">⬆️</span> RENTABILIDAD';
    } else if (value === 'down') {
      badgeEl.classList.add('trend-down');
      badgeEl.innerHTML = '<span class="trend-icon">⬇️</span> CORRECCIÓN';
    } else {
      badgeEl.classList.add('trend-neutral');
      badgeEl.innerHTML = '<span class="trend-icon">➡️</span> ESTABLE';
    }
    scaleCanvas();
  }

  syncTrendBadge(inputMkt1Trend, canvasMkt1Badge);
  syncTrendBadge(inputMkt2Trend, canvasMkt2Badge);
  syncTrendBadge(inputMkt3Trend, canvasMkt3Badge);

  // Alternar visualización de modelo personalizado en base a selección
  inputAIModel.addEventListener('change', () => {
    if (inputAIModel.value === 'custom') {
      customModelGroup.style.display = 'flex';
    } else {
      customModelGroup.style.display = 'none';
    }
  });

  function getSelectedAIModel() {
    if (inputAIModel.value === 'custom') {
      return inputAIModelCustom.value.trim() || 'gemini-3.5-flash';
    }
    return inputAIModel.value;
  }

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
      // Tilted arm SVG (Balanza positiva)
      document.getElementById('svg-scale-arm').setAttribute('transform', 'rotate(-12 100 50)');
    } else {
      canvas.classList.remove('sentiment-positive');
      canvas.classList.add('sentiment-negative');
      postSentimentIndicator.textContent = 'Noticia Negativa';
      postSentimentIndicator.className = 'sentiment-indicator negative';
      // Tilted arm SVG (Balanza negativa)
      document.getElementById('svg-scale-arm').setAttribute('transform', 'rotate(12 100 50)');
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
      scale: 1, // Escala de imagen final
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

  // --- Función para mostrar un overlay de carga premium ---
  function showLoadingOverlay(message) {
    let overlay = document.getElementById('premium-loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'premium-loading-overlay';
      overlay.innerHTML = `
        <div class="loader-content">
          <div class="loader-spinner">🌀</div>
          <p class="loader-message">${message}</p>
        </div>
      `;
      document.body.appendChild(overlay);
    } else {
      overlay.querySelector('.loader-message').textContent = message;
    }
    overlay.style.display = 'flex';
  }

  function hideLoadingOverlay() {
    const overlay = document.getElementById('premium-loading-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

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
          <div class="news-item-actions">
            <button class="btn btn-primary btn-generate-ai" style="margin-top: 10px; width: 100%; font-size: 0.8rem; padding: 0.55rem 1rem;">
              ⚡ Generar Post e Infografía con IA
            </button>
          </div>
        `;
        
        // Al hacer clic en una noticia simple, rellenar el titular
        card.addEventListener('click', (e) => {
          // Evitar que el clic en el botón de generar propague al contenedor
          if (e.target.classList.contains('btn-generate-ai')) return;

          if (confirm(`¿Quieres utilizar el titular "${item.title}" para tu infografía de hoy?`)) {
            inputHeadline.value = item.title.toUpperCase();
            canvasTitle.textContent = item.title.toUpperCase();
            inputCategory.value = item.sourceCategory.toUpperCase();
            canvasTag.textContent = item.sourceCategory.toUpperCase();
            scaleCanvas();
          }
        });

        // Botón de generación con Inteligencia Artificial (Gemini)
        const btnGen = card.querySelector('.btn-generate-ai');
        btnGen.addEventListener('click', async (e) => {
          e.stopPropagation(); // Detener propagación
          
          if (!confirm(`¿Quieres generar un post completo y diseñar su infografía para esta noticia usando Gemini?`)) {
            return;
          }

          // Mostrar loading overlay
          showLoadingOverlay("Generando post e infografía premium con la Inteligencia de Gemini...");

          try {
            const response = await fetch(`${API_BASE}/api/proposals/generate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: item.title,
                snippet: item.snippet,
                sourceName: item.sourceName,
                model: getSelectedAIModel() // Envía el modelo dinámico a la API
              })
            });

            const resData = await response.json();
            
            if (resData.success) {
              const proposal = resData.proposal;
              
              // Rellenar post
              postTextarea.value = proposal.postText;
              charCount.textContent = postTextarea.value.length;
              
              // Rellenar inputs de la infografía
              const info = proposal.infographicData;
              inputHeadline.value = info.headline || '';
              inputCategory.value = info.category || '';
              inputSentiment.checked = info.sentiment !== undefined ? info.sentiment : true;
              inputMetric.value = info.metric || '';
              inputMetricSub.value = info.metricSub || '';
              inputCtxText.value = info.ctxText || '';
              inputBullet1.value = info.bullet1 || '';
              inputBullet2.value = info.bullet2 || '';
              inputBullet3.value = info.bullet3 || '';
              
              inputMkt1Name.value = info.mkt1Name || '';
              inputMkt1Trend.value = info.mkt1Trend || 'down';
              
              inputMkt2Name.value = info.mkt2Name || '';
              inputMkt2Trend.value = info.mkt2Trend || 'up';
              
              inputMkt3Name.value = info.mkt3Name || '';
              inputMkt3Trend.value = info.mkt3Trend || 'down';
              
              inputSource.value = info.sourceText || '';
              
              // Sincronizar Canvas
              canvasTitle.textContent = info.headline || '...';
              canvasTag.textContent = info.category || '...';
              canvasMetric.textContent = info.metric || '...';
              canvasMetricSub.textContent = info.metricSub || '...';
              canvasCtxText.textContent = info.ctxText || '...';
              canvasBullet1.textContent = info.bullet1 || '...';
              canvasBullet2.textContent = info.bullet2 || '...';
              canvasBullet3.textContent = info.bullet3 || '...';
              
              canvasMkt1Name.textContent = info.mkt1Name || '...';
              canvasMkt2Name.textContent = info.mkt2Name || '...';
              canvasMkt3Name.textContent = info.mkt3Name || '...';
              
              canvasFooterSource.textContent = info.sourceText || '...';
              
              updateTrendBadgeUI(inputMkt1Trend.value, canvasMkt1Badge);
              updateTrendBadgeUI(inputMkt2Trend.value, canvasMkt2Badge);
              updateTrendBadgeUI(inputMkt3Trend.value, canvasMkt3Badge);
              
              updateSentimentTheme(inputSentiment.checked);
              scaleCanvas();
              
              hideLoadingOverlay();
              
              // Opcional: Generar también la ilustración de IA de alto impacto
              alert('¡Propuesta generada con éxito con la Inteligencia de Gemini! Ya tienes todo cargado en pantalla.');
            } else {
              hideLoadingOverlay();
              alert('No se pudo generar la propuesta: ' + resData.error);
            }
          } catch (err) {
            console.error('Error en generación de propuesta:', err);
            hideLoadingOverlay();
            alert('Error de conexión con el servidor. Asegúrate de tener configurada la variable de entorno GEMINI_API_KEY en tu Synology NAS o en el archivo .env de la aplicación.');
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
        metricSub: inputMetricSub.value,
        ctxText: inputCtxText.value,
        bullet1: inputBullet1.value,
        bullet2: inputBullet2.value,
        bullet3: inputBullet3.value,
        mkt1Name: inputMkt1Name.value,
        mkt1Trend: inputMkt1Trend.value,
        mkt2Name: inputMkt2Name.value,
        mkt2Trend: inputMkt2Trend.value,
        mkt3Name: inputMkt3Name.value,
        mkt3Trend: inputMkt3Trend.value,
        sourceText: inputSource.value
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
        alert('¡Propuesta avanzada guardada correctamente en tu NAS!');
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
        inputMetricSub.value = info.metricSub || '';
        
        inputCtxText.value = info.ctxText || '';
        
        inputBullet1.value = info.bullet1 || '';
        inputBullet2.value = info.bullet2 || '';
        inputBullet3.value = info.bullet3 || '';
        
        inputMkt1Name.value = info.mkt1Name || '';
        inputMkt1Trend.value = info.mkt1Trend || 'down';
        
        inputMkt2Name.value = info.mkt2Name || '';
        inputMkt2Trend.value = info.mkt2Trend || 'up';
        
        inputMkt3Name.value = info.mkt3Name || '';
        inputMkt3Trend.value = info.mkt3Trend || 'down';
        
        inputSource.value = info.sourceText || '';
        
        // Sincronizar Canvas
        canvasTitle.textContent = info.headline || '...';
        canvasTag.textContent = info.category || '...';
        canvasMetric.textContent = info.metric || '...';
        canvasMetricSub.textContent = info.metricSub || '...';
        canvasCtxText.textContent = info.ctxText || '...';
        canvasBullet1.textContent = info.bullet1 || '...';
        canvasBullet2.textContent = info.bullet2 || '...';
        canvasBullet3.textContent = info.bullet3 || '...';
        
        canvasMkt1Name.textContent = info.mkt1Name || '...';
        canvasMkt2Name.textContent = info.mkt2Name || '...';
        canvasMkt3Name.textContent = info.mkt3Name || '...';
        
        canvasFooterSource.textContent = info.sourceText || '...';
        
        updateTrendBadgeUI(inputMkt1Trend.value, canvasMkt1Badge);
        updateTrendBadgeUI(inputMkt2Trend.value, canvasMkt2Badge);
        updateTrendBadgeUI(inputMkt3Trend.value, canvasMkt3Badge);
        
        updateSentimentTheme(inputSentiment.checked);
        scaleCanvas();
      }
    } catch (error) {
      console.warn('No hay propuesta diaria previa o servidor apagado.');
    }
  }

  // --- 6. Inicialización ---
  loadLatestProposal();
  syncAndLoadNews();

  // Actualizar la etiqueta de fecha del header
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('current-date-badge').textContent = new Date().toLocaleDateString('es-ES', options);

});
