// ==========================================================================
// LÓGICA DE CONTROL AVANZADA - DASHBOARD POSTLINKEDIN
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  
  // --- Elementos del DOM ---
  const canvas = document.getElementById('infographic-canvas-element');
  const viewport = canvas.parentElement;
  
  // Inputs del editor de infografía (dentro de la tarjeta de configuración)
  const inputSentiment = document.getElementById('info-sentiment');

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
  const btnCopyPost = document.getElementById('btn-copy-post');
  const btnSaveProposal = document.getElementById('btn-save-proposal');
  const btnDownloadInfo = document.getElementById('btn-download-infographic');
  
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

  // --- 2. Interactividad directa del Canvas (Edición en vivo) ---
  
  // Sincronizar escalado al editar directamente en el lienzo
  canvas.querySelectorAll('[contenteditable="true"]').forEach(el => {
    el.addEventListener('input', () => {
      scaleCanvas();
    });
  });

  // --- Infografía: relleno y lectura de todos los campos ---
  const $ig = (id) => document.getElementById(id);

  // Reduce el tamaño de la cifra principal hasta que quepa en su columna
  function fitMetric() {
    const el = $ig('canvas-metric-value');
    if (!el) return;
    let size = 150;
    el.style.fontSize = size + 'px';
    const maxW = el.parentElement.clientWidth;
    while (el.scrollWidth > maxW && size > 56) {
      size -= 4;
      el.style.fontSize = size + 'px';
    }
  }

  // Titular: el mayor tamaño (hasta 70 px) con el que ocupa como mucho 3 líneas y todo el lienzo cabe en 1350 px
  function fitHeadline() {
    const el = $ig('canvas-title-text');
    if (!el) return;
    let size = 70;
    el.style.fontSize = size + 'px';
    while ((el.offsetHeight > Math.ceil(size * 1.03 * 3) + 2 || canvas.scrollHeight > 1350) && size > 40) {
      size -= 2;
      el.style.fontSize = size + 'px';
    }
  }

  function renderBars(bars) {
    const box = $ig('canvas-bars');
    if (!box) return;
    box.innerHTML = '';
    (Array.isArray(bars) ? bars : []).slice(0, 5).forEach((b) => {
      const pct = Math.max(4, Math.min(100, Number(b.pct) || 50));
      const row = document.createElement('div');
      row.className = 'ig-bar-row';
      row.innerHTML = '<span class="ig-bar-label" contenteditable="true" spellcheck="false"></span>' +
        '<div class="ig-bar-track" title="Clic para cambiar la longitud de la barra"><div class="ig-bar-fill"></div></div>' +
        '<span class="ig-bar-value" contenteditable="true" spellcheck="false"></span>';
      row.querySelector('.ig-bar-label').textContent = b.label || '';
      row.querySelector('.ig-bar-value').textContent = b.value || '';
      const fill = row.querySelector('.ig-bar-fill');
      fill.style.width = pct + '%';
      fill.dataset.pct = String(pct);
      row.querySelector('.ig-bar-track').addEventListener('click', () => {
        const nuevo = prompt('Longitud de la barra (4 a 100):', fill.dataset.pct);
        const n = Math.max(4, Math.min(100, Number(nuevo)));
        if (nuevo !== null && !Number.isNaN(n)) { fill.style.width = n + '%'; fill.dataset.pct = String(n); }
      });
      box.appendChild(row);
    });
    box.parentElement.style.display = box.children.length ? '' : 'none';   // propuestas antiguas sin barras
  }

  function readBars() {
    return Array.from(document.querySelectorAll('#canvas-bars .ig-bar-row')).map((row) => ({
      label: row.querySelector('.ig-bar-label').textContent.trim(),
      value: row.querySelector('.ig-bar-value').textContent.trim(),
      pct: Number(row.querySelector('.ig-bar-fill').dataset.pct) || 50
    }));
  }

  // --- Infografía como imagen generada por la IA ---
  const aiImg = $ig('ai-image');
  const aiPrompt = $ig('ai-image-prompt');
  const aiStatus = $ig('ai-image-status');
  const btnGenImage = $ig('btn-generate-image');
  const modeImageBtn = $ig('mode-image');
  const modeTemplateBtn = $ig('mode-template');
  const imgModelSel = $ig('info-image-model');
  const imgModelCustom = $ig('info-image-model-custom');
  let aiImageUrl = null;      // URL local (blob) de la imagen del usuario
  let aiImageMime = 'image/png';
  let viewMode = 'template';  // 'image' | 'template'
  let currentVisual = { apto: false, estilo: '' };

  imgModelSel.addEventListener('change', () => {
    $ig('custom-image-model-group').style.display = imgModelSel.value === 'custom' ? 'flex' : 'none';
  });
  const getImageModel = () => (imgModelSel.value === 'custom' ? (imgModelCustom.value.trim() || undefined) : imgModelSel.value);

  function setStatus(texto, error) {
    aiStatus.textContent = texto || '';
    aiStatus.style.color = error ? 'var(--accent)' : '';
  }

  function setViewMode(m) {
    viewMode = (m === 'image' && aiImageUrl) ? 'image' : 'template';
    aiImg.hidden = viewMode !== 'image';
    modeImageBtn.classList.toggle('active', viewMode === 'image');
    modeTemplateBtn.classList.toggle('active', viewMode === 'template');
  }
  modeImageBtn.addEventListener('click', () => {
    if (!aiImageUrl) { setStatus('Todavía no hay imagen: pulsa «Generar imagen con IA».', true); return; }
    setViewMode('image');
  });
  modeTemplateBtn.addEventListener('click', () => setViewMode('template'));

  async function loadAiImage() {
    try {
      const r = await fetch(`${API_BASE}/api/infographic/image`);
      if (!r.ok) { aiImageUrl = null; return false; }
      const blob = await r.blob();
      if (aiImageUrl) URL.revokeObjectURL(aiImageUrl);
      aiImageMime = blob.type || 'image/png';
      aiImageUrl = URL.createObjectURL(blob);
      aiImg.src = aiImageUrl;
      return true;
    } catch { return false; }
  }

  function clearAiImage() {
    if (aiImageUrl) URL.revokeObjectURL(aiImageUrl);
    aiImageUrl = null;
    aiImg.removeAttribute('src');
    setViewMode('template');
  }

  async function generateImage() {
    btnGenImage.disabled = true;
    setStatus('Enviando a la IA…');
    try {
      const r = await fetch(`${API_BASE}/api/infographic/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.value, model: getImageModel(), infographicData: readInfographic() })
      });
      const d = await r.json();
      if (!d.success) { setStatus(d.error || 'No se pudo lanzar la imagen.', true); return; }
      const inicio = Date.now();
      while (Date.now() - inicio < 300000) {
        await new Promise((ok) => setTimeout(ok, 3000));
        const jr = await fetch(`${API_BASE}/api/infographic/job/${d.id}`);
        const j = await jr.json();
        if (j.estado === 'listo') {
          await loadAiImage();
          setViewMode('image');
          setStatus('Imagen lista. Si algún texto sale mal, retoca las instrucciones y vuelve a generarla.');
          return;
        }
        if (j.estado === 'error') { setStatus(j.error || 'La IA no pudo generar la imagen.', true); return; }
        setStatus(`Generando la imagen con la IA… ${Math.round((Date.now() - inicio) / 1000)} s (puede tardar hasta 90 s)`);
      }
      setStatus('La IA tarda demasiado. Inténtalo de nuevo en un momento.', true);
    } catch (e) {
      setStatus('Error de conexión al generar la imagen.', true);
    } finally {
      btnGenImage.disabled = false;
    }
  }
  btnGenImage.addEventListener('click', generateImage);

  function fillInfographic(info) {
    const isPositive = info.sentiment !== undefined ? info.sentiment : true;
    if (inputSentiment) inputSentiment.value = isPositive ? 'positive' : 'negative';

    canvasTitle.textContent = info.headline || '...';
    canvasTag.textContent = info.category || '...';
    $ig('canvas-icon').textContent = info.icon || '📊';
    canvasMetric.textContent = info.metric || '...';
    canvasMetricSub.textContent = info.metricSub || '...';
    canvasCtxText.textContent = info.ctxText || '...';

    const stats = Array.isArray(info.stats) ? info.stats : [];
    [1, 2, 3].forEach((n) => {
      const st = stats[n - 1] || {};
      $ig(`canvas-stat-${n}-value`).textContent = st.value || '—';
      $ig(`canvas-stat-${n}-label`).textContent = st.label || '';
    });

    $ig('canvas-bars-title').textContent = info.barsTitle || 'EN PERSPECTIVA';
    renderBars(info.bars);

    canvasBullet1.innerHTML = info.bullet1 || '...';
    canvasBullet2.innerHTML = info.bullet2 || '...';
    canvasBullet3.innerHTML = info.bullet3 || '...';

    canvasMkt1Name.textContent = info.mkt1Name || '...';
    canvasMkt2Name.textContent = info.mkt2Name || '...';
    canvasMkt3Name.textContent = info.mkt3Name || '...';
    updateTrendBadgeUI(info.mkt1Trend || 'down', canvasMkt1Badge);
    updateTrendBadgeUI(info.mkt2Trend || 'up', canvasMkt2Badge);
    updateTrendBadgeUI(info.mkt3Trend || 'down', canvasMkt3Badge);

    $ig('canvas-takeaway').textContent = info.takeaway || '';
    currentVisual = { apto: !!(info.visual && info.visual.apto), estilo: (info.visual && info.visual.estilo) || '' };
    aiPrompt.value = (info.visual && info.visual.imagePrompt) || '';
    canvasFooterSource.textContent = info.sourceText || '...';

    updateSentimentTheme(isPositive);
    fitMetric();
    fitHeadline();
    scaleCanvas();
  }

  function readInfographic() {
    const getTrendFromBadge = (badgeEl) => {
      if (badgeEl.classList.contains('trend-up')) return 'up';
      if (badgeEl.classList.contains('trend-down')) return 'down';
      return 'neutral';
    };
    return {
      headline: canvasTitle.textContent,
      category: canvasTag.textContent,
      icon: $ig('canvas-icon').textContent.trim(),
      sentiment: inputSentiment ? (inputSentiment.value === 'positive') : true,
      metric: canvasMetric.textContent,
      metricSub: canvasMetricSub.textContent,
      ctxText: canvasCtxText.textContent,
      stats: [1, 2, 3].map((n) => ({ value: $ig(`canvas-stat-${n}-value`).textContent.trim(), label: $ig(`canvas-stat-${n}-label`).textContent.trim() })),
      barsTitle: $ig('canvas-bars-title').textContent.trim(),
      bars: readBars(),
      bullet1: canvasBullet1.innerHTML,
      bullet2: canvasBullet2.innerHTML,
      bullet3: canvasBullet3.innerHTML,
      mkt1Name: canvasMkt1Name.textContent,
      mkt1Trend: getTrendFromBadge(canvasMkt1Badge),
      mkt2Name: canvasMkt2Name.textContent,
      mkt2Trend: getTrendFromBadge(canvasMkt2Badge),
      mkt3Name: canvasMkt3Name.textContent,
      mkt3Trend: getTrendFromBadge(canvasMkt3Badge),
      takeaway: $ig('canvas-takeaway').textContent.trim(),
      visual: { apto: currentVisual.apto, estilo: currentVisual.estilo, imagePrompt: aiPrompt.value.trim() },
      sourceText: canvasFooterSource.textContent
    };
  }

  // Función para actualizar los badges de mercado en base a su tendencia
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

  // Configurar clic en los badges de mercado para alternar su estado
  function setupMarketBadgeCycling(badgeEl) {
    if (badgeEl) {
      badgeEl.addEventListener('click', () => {
        let currentTrend = 'neutral';
        if (badgeEl.classList.contains('trend-up')) {
          currentTrend = 'up';
        } else if (badgeEl.classList.contains('trend-down')) {
          currentTrend = 'down';
        }
        
        let nextTrend = 'neutral';
        if (currentTrend === 'up') {
          nextTrend = 'down';
        } else if (currentTrend === 'down') {
          nextTrend = 'neutral';
        } else {
          nextTrend = 'up';
        }
        
        updateTrendBadgeUI(nextTrend, badgeEl);
      });
    }
  }

  setupMarketBadgeCycling(canvasMkt1Badge);
  setupMarketBadgeCycling(canvasMkt2Badge);
  setupMarketBadgeCycling(canvasMkt3Badge);

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
  if (inputSentiment) {
    inputSentiment.addEventListener('change', () => {
      updateSentimentTheme(inputSentiment.value === 'positive');
    });
  }

  function updateSentimentTheme(isPositive) {
    if (isPositive) {
      canvas.classList.remove('sentiment-negative');
      canvas.classList.add('sentiment-positive');
      if (postSentimentIndicator) {
        postSentimentIndicator.textContent = 'Noticia Positiva';
        postSentimentIndicator.className = 'sentiment-indicator positive';
      }
      // Tilted arm SVG (Balanza positiva)
      const svgArm = document.getElementById('svg-scale-arm');
      if (svgArm) svgArm.setAttribute('transform', 'rotate(-12 100 50)');
    } else {
      canvas.classList.remove('sentiment-positive');
      canvas.classList.add('sentiment-negative');
      if (postSentimentIndicator) {
        postSentimentIndicator.textContent = 'Noticia Negativa';
        postSentimentIndicator.className = 'sentiment-indicator negative';
      }
      // Tilted arm SVG (Balanza negativa)
      const svgArm = document.getElementById('svg-scale-arm');
      if (svgArm) svgArm.setAttribute('transform', 'rotate(12 100 50)');
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
    // Modo imagen de IA: se descarga la imagen tal cual la generó el modelo
    if (viewMode === 'image' && aiImageUrl) {
      const ext = aiImageMime.includes('jpeg') ? 'jpg' : aiImageMime.includes('webp') ? 'webp' : 'png';
      const enlace = document.createElement('a');
      enlace.href = aiImageUrl;
      enlace.download = `infografia_ia_${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(enlace);
      enlace.click();
      document.body.removeChild(enlace);
      return;
    }
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
      const headlineSnippet = canvasTitle.textContent
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

  // --- Generar post e infografía a partir de una noticia (la elige news.js: lista, búsqueda o enlace) ---
  async function generateFromItem(item) {
    if (!confirm('¿Quieres generar un post completo y diseñar su infografía para esta noticia usando Gemini?')) return;

    showLoadingOverlay('Generando post e infografía premium con la Inteligencia de Gemini...');
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
        postTextarea.value = proposal.postText;
        charCount.textContent = postTextarea.value.length;

        fillInfographic(proposal.infographicData);
        clearAiImage();
        if (currentVisual.apto && aiPrompt.value) {
          setStatus(`Estilo elegido por la IA: ${currentVisual.estilo || 'ilustrado'}.`);
          generateImage();
        } else {
          setStatus('A la IA esta noticia no le parece apta para una infografía ilustrada: se usa la plantilla. Puedes generar la imagen igualmente.');
        }

        hideLoadingOverlay();
        document.getElementById('linkedin-post-textarea').scrollIntoView({ behavior: 'smooth', block: 'center' });
        const aviso = resData.modelo && resData.modeloPedido && resData.modelo !== resData.modeloPedido ? `\n\nAviso: ${resData.modeloPedido} estaba saturado y se ha usado ${resData.modelo}.` : '';
        alert('¡Propuesta generada con éxito con la Inteligencia de Gemini! Ya tienes todo cargado en pantalla.' + aviso);
      } else {
        hideLoadingOverlay();
        alert('No se pudo generar la propuesta: ' + resData.error);
      }
    } catch (err) {
      console.error('Error en generación de propuesta:', err);
      hideLoadingOverlay();
      alert('Error de conexión con el servidor. Inténtalo de nuevo en unos segundos.');
    }
  }
  document.addEventListener('pl:generate', (e) => generateFromItem(e.detail));

  // Guardar propuesta actual
  btnSaveProposal.addEventListener('click', async () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    
    // Obtener tendencia de los badges
    const getTrendFromBadge = (badgeEl) => {
      if (badgeEl.classList.contains('trend-up')) return 'up';
      if (badgeEl.classList.contains('trend-down')) return 'down';
      return 'neutral';
    };

    const proposal = {
      date: dateStr,
      postText: postTextarea.value,
      infographicData: readInfographic()
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
        
        // Rellenar la infografía
        fillInfographic(data.infographicData);
        loadAiImage().then((ok) => { if (ok) setViewMode('image'); });
      }
    } catch (error) {
      console.warn('No hay propuesta diaria previa o servidor apagado.');
    }
  }

  // --- 6. Inicialización ---
  // Contenido de ejemplo hasta que haya una propuesta, y ajuste de la cifra principal al editarla o al cargar las fuentes
  renderBars([
    { label: 'EE. UU.', value: '124%', pct: 100 },
    { label: 'Japón', value: '230%', pct: 85 },
    { label: 'Zona euro', value: '90%', pct: 60 },
    { label: 'China', value: '84%', pct: 52 }
  ]);
  canvasMetric.addEventListener('input', fitMetric);
  canvasTitle.addEventListener('input', fitHeadline);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitHeadline(); fitMetric(); });
  fitHeadline();
  fitMetric();

  // Arranca solo cuando hay sesión iniciada (auth.js)
  window.onAuthReady(() => {
    loadLatestProposal();
  });

  // Actualizar la etiqueta de fecha del header
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('current-date-badge').textContent = new Date().toLocaleDateString('es-ES', options);

});

