// ==========================================================================
// USUARIOS - acceso, registro, recuperación, 2FA y perfil (clave de Gemini)
// Se carga antes que app.js: añade la sesión a las llamadas /api y retrasa el arranque de la app hasta entrar.
// ==========================================================================
(function () {
  const TOKEN_KEY = 'pl_token';
  const nativeFetch = window.fetch.bind(window);
  const getToken = () => localStorage.getItem(TOKEN_KEY);
  let ready = false;
  const queue = [];

  // La app llama a esto para arrancar solo cuando hay sesión válida
  window.onAuthReady = (cb) => (ready ? cb() : queue.push(cb));

  // Añade la cabecera de sesión a /api y, si el servidor la rechaza, vuelve a la pantalla de acceso
  window.fetch = async (url, opts = {}) => {
    const isApi = typeof url === 'string' && url.startsWith('/api/');
    if (isApi && getToken()) {
      opts = { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${getToken()}` } };
    }
    const res = await nativeFetch(url, opts);
    if (isApi && ready && (res.status === 401 || res.status === 403)) {
      localStorage.removeItem(TOKEN_KEY);
      location.reload();
    }
    return res;
  };

  async function api(method, path, body) {
    const headers = body ? { 'Content-Type': 'application/json' } : {};
    if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
    const res = await nativeFetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) throw Object.assign(new Error(data.error || 'Error'), { status: res.status });
    return data;
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Pantalla de acceso ----------
  let overlay;
  function showAuth(html) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'auth-overlay';
      overlay.setAttribute('data-no-ptr', '');
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `<div class="auth-card glass-card"><div class="auth-brand">📈 <span>PostLinkedIn</span></div>${html}<p class="auth-msg" id="auth-msg"></p></div>`;
    return overlay;
  }
  const msg = (text, ok) => {
    const el = document.getElementById('auth-msg');
    if (el) { el.textContent = text || ''; el.className = 'auth-msg ' + (ok ? 'ok' : 'err'); }
  };
  const $ = (id) => document.getElementById(id);

  function viewLogin(info) {
    showAuth(`
      <h2>Iniciar sesión</h2>
      <form id="f-login" class="auth-form">
        <input type="email" id="a-user" placeholder="Correo electrónico" autocomplete="username" required>
        <input type="password" id="a-pass" placeholder="Contraseña" autocomplete="current-password" required>
        <button class="btn btn-primary" type="submit">Entrar</button>
      </form>
      <div class="auth-links">
        <a href="#" id="l-forgot">¿Has olvidado la contraseña?</a>
        <a href="#" id="l-register">Crear una cuenta</a>
      </div>`);
    if (info) msg(info, true);
    $('l-forgot').onclick = (e) => { e.preventDefault(); viewForgot(); };
    $('l-register').onclick = (e) => { e.preventDefault(); viewRegister(); };
    $('f-login').onsubmit = async (e) => {
      e.preventDefault();
      const username = $('a-user').value.trim();
      try {
        const r = await api('POST', '/login', { username, password: $('a-pass').value });
        if (r.requires2fa) return view2fa(r.tempToken);
        finishLogin(r.token);
      } catch (err) {
        msg(err.message);
        if (err.status === 403) {
          const a = document.createElement('a');
          a.href = '#'; a.textContent = ' Reenviar correo de verificación';
          a.onclick = async (ev) => {
            ev.preventDefault();
            try { await api('POST', '/resend-verification', { username }); msg('Correo de verificación reenviado.', true); } catch (er) { msg(er.message); }
          };
          $('auth-msg').appendChild(a);
        }
      }
    };
  }

  function view2fa(tempToken) {
    showAuth(`
      <h2>Verificación en dos pasos</h2>
      <p class="auth-hint">Introduce el código de 6 dígitos de tu app autenticadora.</p>
      <form id="f-2fa" class="auth-form">
        <input type="text" id="a-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000" required>
        <button class="btn btn-primary" type="submit">Verificar</button>
      </form>
      <div class="auth-links"><a href="#" id="l-back">Volver</a></div>`);
    $('l-back').onclick = (e) => { e.preventDefault(); viewLogin(); };
    $('f-2fa').onsubmit = async (e) => {
      e.preventDefault();
      try { finishLogin((await api('POST', '/login/2fa', { tempToken, code: $('a-code').value.trim() })).token); } catch (err) { msg(err.message); }
    };
  }

  function viewRegister() {
    showAuth(`
      <h2>Crear cuenta</h2>
      <form id="f-reg" class="auth-form">
        <input type="email" id="a-user" placeholder="Correo electrónico" autocomplete="username" required>
        <input type="password" id="a-pass" placeholder="Contraseña" autocomplete="new-password" required>
        <button class="btn btn-primary" type="submit">Registrarme</button>
      </form>
      <div class="auth-links"><a href="#" id="l-back">Ya tengo cuenta</a></div>`);
    $('l-back').onclick = (e) => { e.preventDefault(); viewLogin(); };
    $('f-reg').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const r = await api('POST', '/register', { username: $('a-user').value.trim(), password: $('a-pass').value });
        viewLogin(r.message);
      } catch (err) { msg(err.message); }
    };
  }

  function viewForgot() {
    showAuth(`
      <h2>Recuperar contraseña</h2>
      <p class="auth-hint">Te enviaremos un enlace para crear una contraseña nueva.</p>
      <form id="f-forgot" class="auth-form">
        <input type="email" id="a-user" placeholder="Correo electrónico" autocomplete="username" required>
        <button class="btn btn-primary" type="submit">Enviar enlace</button>
      </form>
      <div class="auth-links"><a href="#" id="l-back">Volver</a></div>`);
    $('l-back').onclick = (e) => { e.preventDefault(); viewLogin(); };
    $('f-forgot').onsubmit = async (e) => {
      e.preventDefault();
      try { await api('POST', '/forgot-password', { email: $('a-user').value.trim() }); msg('Si la cuenta existe, recibirás un correo con el enlace.', true); } catch (err) { msg(err.message); }
    };
  }

  function viewReset(token) {
    showAuth(`
      <h2>Nueva contraseña</h2>
      <form id="f-reset" class="auth-form">
        <input type="password" id="a-pass" placeholder="Contraseña nueva" autocomplete="new-password" required>
        <button class="btn btn-primary" type="submit">Cambiar contraseña</button>
      </form>`);
    $('f-reset').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('POST', '/reset-password', { token, newPassword: $('a-pass').value });
        history.replaceState(null, '', location.pathname);
        viewLogin('Contraseña cambiada. Ya puedes entrar.');
      } catch (err) { msg(err.message); }
    };
  }

  async function viewVerify(token) {
    showAuth('<h2>Verificando tu cuenta…</h2>');
    history.replaceState(null, '', location.pathname);
    try { await api('POST', '/verify', { token }); viewLogin('Cuenta verificada. Ya puedes entrar.'); } catch (err) { viewLogin(); msg(err.message); }
  }

  function finishLogin(token) {
    localStorage.setItem(TOKEN_KEY, token);
    location.reload();
  }

  // ---------- Menú de usuario y perfil ----------
  function setupUserMenu(me) {
    const old = $('user-slot');
    const wrap = document.createElement('div');
    wrap.className = 'user-menu-wrap';
    wrap.innerHTML = `
      <button class="btn btn-secondary user-btn" id="btn-user" title="Menú de usuario" aria-label="Menú de usuario"><span class="user-avatar">${esc(me.username[0].toUpperCase())}</span><span class="user-name">${esc(me.username)}</span></button>
      <div class="user-dropdown" id="user-dropdown" hidden>
        <div class="user-dropdown-head">${esc(me.username)}</div>
        <button type="button" id="mi-profile">⚙️ Mi perfil</button>
        <button type="button" id="mi-logout" class="danger">🚪 Cerrar sesión</button>
      </div>`;
    old.replaceWith(wrap);
    const dd = $('user-dropdown');
    $('btn-user').onclick = (e) => { e.stopPropagation(); dd.hidden = !dd.hidden; };
    document.addEventListener('click', (e) => { if (!e.target.closest('.user-menu-wrap')) dd.hidden = true; });
    $('mi-profile').onclick = () => { dd.hidden = true; openProfile(); };
    $('mi-logout').onclick = () => { localStorage.removeItem(TOKEN_KEY); location.reload(); };
    if (!me.hasGeminiKey) setTimeout(() => { if (confirm('Aún no has guardado tu clave de Gemini, necesaria para generar posts. ¿Quieres añadirla ahora?')) openProfile(); }, 400);
  }

  async function openProfile() {
    let me;
    try { me = await api('GET', '/me'); } catch { return; }
    const m = document.createElement('div');
    m.className = 'auth-overlay';
    m.setAttribute('data-no-ptr', '');
    m.innerHTML = `
      <div class="auth-card glass-card profile-card">
        <div class="profile-head"><h2>Mi perfil</h2><button class="btn btn-secondary" id="p-close" aria-label="Cerrar">✕</button></div>
        <p class="auth-hint">${esc(me.username)}</p>

        <h3>Clave de Gemini</h3>
        <p class="auth-hint">${me.hasGeminiKey ? `Guardada (termina en …${esc(me.geminiKeyLast4 || '')}). Se almacena cifrada en el servidor y solo tú la usas.` : 'Aún no hay ninguna clave guardada. Consíguela en Google AI Studio.'}</p>
        <form id="p-key-form" class="auth-form">
          <input type="password" id="p-key" placeholder="${me.hasGeminiKey ? 'Pega una clave nueva para cambiarla' : 'Pega tu clave API de Gemini'}" autocomplete="off">
          <div class="auth-row"><button class="btn btn-primary" type="submit">Guardar clave</button><button class="btn btn-secondary" type="button" id="p-key-test">Probar</button>${me.hasGeminiKey ? '<button class="btn btn-secondary" type="button" id="p-key-del">Borrar</button>' : ''}</div>
        </form>

        <h3>Doble factor (app autenticadora)</h3>
        <div id="p-2fa"></div>

        <h3>Cambiar contraseña</h3>
        <form id="p-pass-form" class="auth-form">
          <input type="password" id="p-cur" placeholder="Contraseña actual" autocomplete="current-password" required>
          <input type="password" id="p-new" placeholder="Contraseña nueva" autocomplete="new-password" required>
          <button class="btn btn-secondary" type="submit">Cambiar contraseña</button>
        </form>

        <h3>Eliminar cuenta</h3>
        <button class="btn btn-secondary danger" id="p-delete">Eliminar mi cuenta y mis datos</button>
        <p class="auth-msg" id="auth-msg"></p>
      </div>`;
    document.body.appendChild(m);
    const close = () => m.remove();
    $('p-close').onclick = close;
    m.addEventListener('click', (e) => { if (e.target === m) close(); });

    $('p-key-form').onsubmit = async (e) => {
      e.preventDefault();
      try { await api('PUT', '/gemini-key', { key: $('p-key').value }); close(); openProfile(); } catch (err) { msg(err.message); }
    };
    $('p-key-test').onclick = async () => {
      const sel = $('info-ai-model');
      const model = sel && sel.value !== 'custom' ? sel.value : ($('info-ai-model-custom') && $('info-ai-model-custom').value.trim()) || undefined;
      const btn = $('p-key-test');
      btn.disabled = true; msg('Probando la clave…', true);
      try {
        const r = await api('POST', '/gemini-key/test', { key: $('p-key').value, model });
        msg(`Clave correcta (modelo ${r.model}).`, true);
      } catch (err) { msg(err.message); }
      btn.disabled = false;
    };
    if ($('p-key-del')) $('p-key-del').onclick = async () => { if (confirm('¿Borrar tu clave de Gemini?')) { await api('DELETE', '/gemini-key'); close(); openProfile(); } };

    $('p-pass-form').onsubmit = async (e) => {
      e.preventDefault();
      try { await api('POST', '/change-password', { currentPassword: $('p-cur').value, newPassword: $('p-new').value }); e.target.reset(); msg('Contraseña cambiada.', true); } catch (err) { msg(err.message); }
    };

    $('p-delete').onclick = async () => {
      if (!confirm('Se borrará tu cuenta y tus propuestas guardadas. Esta acción no se puede deshacer. ¿Continuar?')) return;
      try { await api('POST', '/delete-account'); localStorage.removeItem(TOKEN_KEY); location.reload(); } catch (err) { msg(err.message); }
    };

    const box = $('p-2fa');
    const render2fa = (enabled) => {
      if (enabled) {
        box.innerHTML = '<p class="auth-hint">Activado.</p><button class="btn btn-secondary" id="p-2fa-off">Desactivar</button>';
        $('p-2fa-off').onclick = async () => { if (confirm('¿Desactivar el doble factor?')) { await api('POST', '/2fa/disable'); render2fa(false); } };
      } else {
        box.innerHTML = '<p class="auth-hint">Desactivado.</p><button class="btn btn-secondary" id="p-2fa-on">Activar</button>';
        $('p-2fa-on').onclick = async () => {
          try {
            const r = await api('POST', '/2fa/setup');
            box.innerHTML = `<p class="auth-hint">Escanea el QR con tu app autenticadora y escribe el código.</p>
              <img class="qr" src="${r.qrCode}" alt="QR 2FA"><p class="auth-hint mono">${esc(r.secret)}</p>
              <form id="p-2fa-form" class="auth-form"><input type="text" id="p-2fa-code" inputmode="numeric" maxlength="6" placeholder="000000" required><button class="btn btn-primary" type="submit">Confirmar</button></form>`;
            $('p-2fa-form').onsubmit = async (e) => {
              e.preventDefault();
              try { await api('POST', '/2fa/verify-setup', { token: $('p-2fa-code').value.trim() }); render2fa(true); msg('Doble factor activado.', true); } catch (err) { msg(err.message); }
            };
          } catch (err) { msg(err.message); }
        };
      }
    };
    render2fa(me.twoFactorEnabled);
  }

  // ---------- Arranque ----------
  document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    const token = params.get('token');
    if (action === 'verify' && token) return viewVerify(token);
    if (action === 'reset' && token) return viewReset(token);

    if (getToken()) {
      try {
        const me = await api('GET', '/me');
        ready = true;
        setupUserMenu(me);
        queue.splice(0).forEach((cb) => cb());
        return;
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    viewLogin();
  });
})();
