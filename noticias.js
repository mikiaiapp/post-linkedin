// Noticias: validación segura de direcciones (evita que el servidor pida páginas de la red interna) y lectura de una noticia a partir de su enlace.
const dns = require('dns').promises;
const net = require('net');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function ipPrivada(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const x = ip.toLowerCase();
  if (x.startsWith('::ffff:')) return ipPrivada(x.slice(7));
  return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80');
}

// Devuelve la URL ya normalizada si es http(s) y apunta a una dirección pública; si no, lanza un error legible
async function urlSegura(texto) {
  let u;
  try { u = new URL(String(texto || '').trim()); } catch { throw new Error('La dirección no es válida.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Solo se admiten direcciones http o https.');
  if (u.username || u.password) throw new Error('La dirección no puede llevar usuario ni contraseña.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Esa dirección no es pública.');
  const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => { throw new Error('No se encuentra ese sitio.'); })).map((r) => r.address);
  if (!ips.length || ips.some(ipPrivada)) throw new Error('Esa dirección no es pública.');
  return u;
}

// Descarga una página siguiendo como mucho 4 redirecciones y comprobando cada salto
async function descargarPagina(url, maxBytes = 1500000) {
  let actual = (await urlSegura(url)).href;
  for (let salto = 0; salto < 5; salto++) {
    const res = await fetch(actual, { redirect: 'manual', headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'es-ES,es;q=0.9' }, signal: AbortSignal.timeout(15000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      actual = (await urlSegura(new URL(res.headers.get('location'), actual).href)).href;
      continue;
    }
    if (!res.ok) throw new Error(`El sitio respondió ${res.status}${res.status === 403 ? ' (bloquea la lectura automática)' : ''}.`);
    const tipo = res.headers.get('content-type') || '';
    if (!/html|xml/i.test(tipo)) throw new Error('El enlace no es una página web.');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new Error('La página es demasiado grande.');
    const m = /charset=([\w-]+)/i.exec(tipo) || /<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.subarray(0, 4096).toString('latin1'));
    let cs = (m && m[1] || 'utf-8').toLowerCase();
    try { new TextDecoder(cs); } catch { cs = 'utf-8'; }
    return { html: new TextDecoder(cs).decode(buf), url: actual };
  }
  throw new Error('Demasiadas redirecciones.');
}

const NOMBRADAS = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', euro: '€', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
const decodificar = (s) => String(s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&([a-zA-Z]+);/g, (m, n) => (n in NOMBRADAS ? NOMBRADAS[n] : m));
const limpiar = (s) => decodificar(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function meta(html, ...nombres) {
  for (const n of nombres) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*>`, 'i');
    const tag = re.exec(html);
    if (tag) { const c = /content=["']([^"']*)["']/i.exec(tag[0]); if (c && c[1].trim()) return limpiar(c[1]); }
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${n}["']`, 'i');
    const t2 = re2.exec(html);
    if (t2 && t2[1].trim()) return limpiar(t2[1]);
  }
  return '';
}

// Extrae título, resumen y primeros párrafos del artículo
function extraerNoticia(html, url) {
  const sinRuido = html.replace(/<(script|style|noscript|svg|nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, ' ');
  let titulo = meta(html, 'og:title', 'twitter:title') || limpiar((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1]);
  const h1 = limpiar((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(sinRuido) || [])[1]);
  if (!titulo && h1) titulo = h1;
  const descripcion = meta(html, 'og:description', 'description', 'twitter:description');
  const zona = (/<article[\s\S]*?<\/article>/i.exec(sinRuido) || [sinRuido])[0];
  const parrafos = [];
  for (const m of zona.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const t = limpiar(m[1]);
    if (t.length >= 60 && !parrafos.includes(t)) parrafos.push(t);
    if (parrafos.join(' ').length > 2500) break;
  }
  const cuerpo = parrafos.join('\n').slice(0, 2800);
  const host = new URL(url).hostname.replace(/^www\./, '');
  return { title: titulo.slice(0, 300), snippet: [descripcion, cuerpo].filter(Boolean).join('\n').slice(0, 3500), sourceName: host, link: url };
}

module.exports = { urlSegura, descargarPagina, extraerNoticia, ipPrivada };
