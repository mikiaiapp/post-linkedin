// ==========================================================================
// NOTICIAS: lista a todo el ancho (búsqueda, filtros, orden por impacto), fuentes RSS editables y noticia por enlace o pegada a mano.
// Al elegir una noticia lanza el evento «pl:generate» que atiende app.js.
// ==========================================================================
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const quitarTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let todas = [];

  const list = $('scraped-news-list');
  const badge = $('news-count-badge');

  function hace(fecha) {
    if (!fecha) return 'Hoy';
    const m = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
    if (Number.isNaN(m)) return 'Hoy';
    if (m < 1) return 'ahora';
    if (m < 60) return `hace ${m} min`;
    if (m < 1440) return `hace ${Math.round(m / 60)} h`;
    return new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }

  async function cargar() {
    list.innerHTML = '<div class="loading-state"><span class="spinner">⏳</span><p>Leyendo las portadas de la prensa económica…</p></div>';
    badge.textContent = 'Cargando...';
    try {
      const r = await fetch('/api/news');
      todas = await r.json();
      const sel = $('news-source-filter');
      const actual = sel.value;
      const fuentes = [...new Set(todas.map((n) => n.sourceName))].sort();
      sel.innerHTML = '<option value="">Todas las fuentes</option>' + fuentes.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
      sel.value = fuentes.includes(actual) ? actual : '';
      pintar();
    } catch (e) {
      console.error('Error cargando noticias:', e);
      list.innerHTML = '<p class="section-desc">No se pudieron leer las noticias. Revisa las fuentes con «⚙️ Fuentes».</p>';
      badge.textContent = 'Error';
    }
  }

  function pintar() {
    const q = quitarTildes($('news-search').value.trim());
    const fuente = $('news-source-filter').value;
    const solo24 = $('news-only-recent').checked;
    const orden = $('news-sort').value;

    let items = todas.filter((n) =>
      (!fuente || n.sourceName === fuente) &&
      (!solo24 || (n.impacto && n.impacto.reciente)) &&
      (!q || quitarTildes(`${n.title} ${n.snippet}`).includes(q)));
    if (orden === 'fecha') items = [...items].sort((a, b) => (new Date(b.pubDate || 0)) - (new Date(a.pubDate || 0)));

    const recientes = todas.filter((n) => n.impacto && n.impacto.reciente).length;
    badge.textContent = items.length === todas.length ? `${todas.length} noticias · ${recientes} en 24 h` : `${items.length} de ${todas.length} noticias`;

    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = '<p class="section-desc">No hay noticias con esos filtros.</p>';
      return;
    }
    items.forEach((n) => list.appendChild(tarjeta(n)));
  }

  function tarjeta(n) {
    const caliente = n.impacto && n.impacto.diarios > 1;
    const card = document.createElement('article');
    card.className = 'news-card' + (caliente ? ' hot' : '');
    card.innerHTML = `
      <div class="news-card-head">
        <span class="news-card-source">${esc(n.sourceName)}</span>
        ${n.impacto && n.impacto.reciente ? `<span class="news-item-impact" title="Impacto en las últimas 24 horas">${caliente ? `🔥 ${n.impacto.diarios} diarios` : '🕒 24 h'}</span>` : ''}
        <span class="news-card-time">${esc(hace(n.pubDate))}</span>
      </div>
      <h3 class="news-card-title">${esc(n.title)}</h3>
      <p class="news-card-snippet">${esc(n.snippet)}</p>
      <div class="news-card-actions"></div>`;
    const acciones = card.querySelector('.news-card-actions');
    if (/^https?:\/\//i.test(n.link || '')) {
      const a = document.createElement('a');
      a.className = 'btn btn-secondary';
      a.href = n.link; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.textContent = '🔗 Leer';
      acciones.appendChild(a);
    }
    const b = document.createElement('button');
    b.className = 'btn btn-primary btn-generate-ai';
    b.textContent = '⚡ Generar Post e Infografía';
    b.addEventListener('click', () => document.dispatchEvent(new CustomEvent('pl:generate', { detail: { title: n.title, snippet: n.snippet, sourceName: n.sourceName } })));
    acciones.appendChild(b);
    return card;
  }

  // ---------- Noticia por enlace o pegada a mano ----------
  const manual = $('news-manual');
  const msg = (t, error) => { const m = $('news-manual-msg'); m.textContent = t || ''; m.style.color = error ? 'var(--accent)' : ''; };

  function abrirManual(datos) {
    manual.hidden = false;
    if (datos) {
      $('news-manual-title').value = datos.title || '';
      $('news-manual-text').value = datos.snippet || '';
      $('news-manual-source').value = datos.sourceName || '';
    }
    $('news-manual-title').focus();
  }

  $('btn-news-url').addEventListener('click', async () => {
    const url = $('news-url').value.trim();
    if (!url) { abrirManual(); msg('Pega un enlace arriba o escribe aquí el título y el texto.', true); return; }
    const btn = $('btn-news-url');
    btn.disabled = true; btn.textContent = 'Leyendo…';
    try {
      const r = await fetch('/api/news/from-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const d = await r.json();
      if (d.success) {
        abrirManual(d.news);
        msg(`Noticia traída de ${d.news.sourceName}. Revisa el título y el texto, y pulsa «Generar».`);
      } else {
        abrirManual();
        msg(d.error || 'No se pudo leer ese enlace.', true);
      }
    } catch (e) {
      abrirManual(); msg('Error de conexión al leer el enlace.', true);
    } finally {
      btn.disabled = false; btn.textContent = 'Traer noticia';
    }
  });
  $('news-url').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-news-url').click(); });
  $('btn-news-manual').addEventListener('click', () => { abrirManual(); msg(''); });
  $('btn-news-manual-cancel').addEventListener('click', () => { manual.hidden = true; });
  $('btn-news-manual-generate').addEventListener('click', () => {
    const title = $('news-manual-title').value.trim();
    const snippet = $('news-manual-text').value.trim();
    if (!title) { msg('Escribe al menos el título.', true); return; }
    document.dispatchEvent(new CustomEvent('pl:generate', { detail: { title, snippet, sourceName: $('news-manual-source').value.trim() || 'Noticia manual' } }));
  });

  // ---------- Gestor de fuentes RSS ----------
  async function abrirFuentes() {
    let datos;
    try { datos = await (await fetch('/api/sources')).json(); } catch { alert('No se pudieron leer las fuentes.'); return; }
    let fuentes = (datos.sources || []).map((f) => ({ ...f }));

    const m = document.createElement('div');
    m.className = 'auth-overlay';
    m.setAttribute('data-no-ptr', '');
    m.innerHTML = `
      <div class="auth-card glass-card profile-card sources-card">
        <div class="profile-head"><h2>Fuentes de noticias (RSS)</h2><button class="btn btn-secondary" id="src-close" aria-label="Cerrar">✕</button></div>
        <p class="auth-hint" id="src-state"></p>
        <div class="sources-list" id="src-list"></div>
        <h3>Añadir una fuente</h3>
        <div class="source-add">
          <input type="text" id="src-name" placeholder="Nombre (p. ej. Expansión)" maxlength="60">
          <input type="url" id="src-url" placeholder="Dirección del RSS (https://…)">
          <input type="text" id="src-cat" placeholder="Categoría" maxlength="40">
        </div>
        <div class="auth-row">
          <button class="btn btn-secondary" id="src-test">Probar</button>
          <button class="btn btn-secondary" id="src-add">Añadir</button>
        </div>
        <div class="auth-row">
          <button class="btn btn-primary" id="src-save">Guardar y actualizar noticias</button>
          <button class="btn btn-secondary" id="src-reset" title="Volver a las fuentes por defecto">Restaurar por defecto</button>
        </div>
        <p class="auth-msg" id="src-msg"></p>
      </div>`;
    document.body.appendChild(m);
    const q = (id) => m.querySelector('#' + id);
    const decir = (t, ok) => { const e = q('src-msg'); e.textContent = t || ''; e.className = 'auth-msg ' + (ok ? 'ok' : 'err'); };
    const cerrar = () => m.remove();
    q('src-close').onclick = cerrar;
    m.addEventListener('click', (e) => { if (e.target === m) cerrar(); });

    function pintarFuentes() {
      q('src-state').textContent = `${fuentes.length} fuente(s). ${datos.custom ? 'Son tus fuentes personalizadas.' : 'Son las fuentes por defecto: al guardar cambios se crean las tuyas.'}`;
      const box = q('src-list');
      box.innerHTML = '';
      fuentes.forEach((f, i) => {
        const row = document.createElement('div');
        row.className = 'source-row';
        row.innerHTML = '<input type="text" maxlength="60" aria-label="Nombre"><input type="url" aria-label="Dirección"><input type="text" maxlength="40" aria-label="Categoría"><button class="btn btn-secondary danger" title="Quitar">✕</button>';
        const [n, u, c] = row.querySelectorAll('input');
        n.value = f.name || ''; u.value = f.url || ''; c.value = f.category || '';
        n.oninput = () => { fuentes[i].name = n.value; };
        u.oninput = () => { fuentes[i].url = u.value; };
        c.oninput = () => { fuentes[i].category = c.value; };
        row.querySelector('button').onclick = () => { fuentes.splice(i, 1); pintarFuentes(); };
        box.appendChild(row);
      });
    }
    pintarFuentes();

    q('src-test').onclick = async () => {
      const url = q('src-url').value.trim();
      if (!url) { decir('Escribe la dirección del RSS.'); return; }
      decir('Probando…', true);
      try {
        const r = await fetch('/api/sources/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
        const d = await r.json();
        decir(d.success ? `Funciona: «${d.titulo}», ${d.noticias} noticias. Ej.: ${String(d.ejemplo).slice(0, 70)}` : d.error, d.success);
        if (d.success && !q('src-name').value.trim()) q('src-name').value = d.titulo;
      } catch { decir('Error de conexión.'); }
    };
    q('src-add').onclick = () => {
      const url = q('src-url').value.trim();
      if (!url) { decir('Escribe la dirección del RSS.'); return; }
      fuentes.push({ name: q('src-name').value.trim() || url, url, category: q('src-cat').value.trim() || 'Economía' });
      q('src-name').value = ''; q('src-url').value = ''; q('src-cat').value = '';
      pintarFuentes(); decir('Añadida. Pulsa «Guardar» para aplicarla.', true);
    };
    q('src-save').onclick = async () => {
      try {
        const r = await fetch('/api/sources', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sources: fuentes }) });
        const d = await r.json();
        if (!d.success) { decir(d.error); return; }
        cerrar(); cargar();
      } catch { decir('Error de conexión.'); }
    };
    q('src-reset').onclick = async () => {
      if (!confirm('¿Volver a las fuentes por defecto? Se pierden las tuyas.')) return;
      try {
        const d = await (await fetch('/api/sources', { method: 'DELETE' })).json();
        if (d.success) { cerrar(); cargar(); }
      } catch { decir('Error de conexión.'); }
    };
  }

  // ---------- Arranque ----------
  let temporizador;
  $('news-search').addEventListener('input', () => { clearTimeout(temporizador); temporizador = setTimeout(pintar, 200); });
  ['news-source-filter', 'news-sort', 'news-only-recent'].forEach((id) => $(id).addEventListener('change', pintar));
  $('btn-news-sources').addEventListener('click', abrirFuentes);
  $('btn-refresh-news-card').addEventListener('click', cargar);
  const cabecera = $('btn-sync-news');
  if (cabecera) cabecera.addEventListener('click', () => { cargar(); $('news-hub').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  window.onAuthReady(cargar);
})();
