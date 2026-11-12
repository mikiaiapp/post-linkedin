// Infografías como IMAGEN generada por Gemini (modelos «Nano Banana»): ilustraciones, mapas, gráficos y esquemas completos.
// Se usa la clave de Gemini del propio usuario. Las llamadas tardan de 20 a 90 s, así que se lanzan como trabajos y el navegador consulta su estado.
const BASE = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
const FIRMA = 'Creado por https://mafede.i234.me con ayuda de Gemini';

// Instrucciones por defecto cuando la propuesta no trae las de la IA (propuestas antiguas o texto vacío)
function construirPromptImagen(info = {}) {
  const barras = (info.bars || []).map((b) => `${b.label}: ${b.value}`).join('; ');
  const stats = (info.stats || []).map((x) => `${x.value} (${x.label})`).join('; ');
  const alerta = info.sentiment === false;
  return `Infografía profesional vertical en formato 4:5 (1080x1350 píxeles), de muy alto impacto visual, para LinkedIn.
Paleta: ${alerta ? 'rojo granate, rojo intenso y amarillo sobre fondo azul marino oscuro' : 'verde esmeralda, azul y dorado sobre fondo azul marino oscuro'}.
Estructura de arriba abajo:
1) Titular enorme en mayúsculas, en una franja de color: "${info.headline || ''}". Categoría: "${info.category || ''}".
2) Cifra gigante "${info.metric || ''}" (${info.metricSub || ''}) junto a una ilustración 3D grande y atractiva del tema (objetos, banderas, edificios, monedas o lo que corresponda).
3) Tres tarjetas con datos clave: ${stats}.
4) Gráfico de barras horizontales comparativo con colores, números grandes y pictogramas: "${info.barsTitle || ''}" — ${barras}.
5) Tres claves con iconos: ${[info.bullet1, info.bullet2, info.bullet3].map((x) => String(x || '').replace(/<[^>]+>/g, '')).join(' | ')}.
6) Conclusión destacada en una caja de color: "${info.takeaway || ''}".
Pie, en letra pequeña: "${info.sourceText || ''}" y "${FIRMA}".
Contexto: ${info.ctxText || ''}
Texto en español, muy grande, nítido y con alto contraste; ortografía perfecta; copia los textos y cifras exactamente como están; no inventes texto ni cifras.`;
}

// Llama al modelo de imagen y devuelve { mime, data (Buffer) }.
// API actual de Google para imágenes: Interactions API (POST /v1beta/interactions, cabecera Api-Revision). Si el servidor no la
// conoce (404/405) se prueba el generateContent clásico por si se usa un modelo antiguo.
const REVISION = process.env.GEMINI_API_REVISION || '2026-05-20';
const TAMANO = process.env.GEMINI_IMAGE_SIZE || '2K';   // 1K, 2K o 4K (K en mayúscula): 2K da texto más legible

async function llamar(url, headers, cuerpo, apiKey) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey, ...headers }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(240000) });
  let body = null;
  try { body = await res.json(); } catch { /* sin JSON */ }
  return { res, body };
}

const SIN_CUOTA = /quota|billing|exceeded your current|free.?tier|RESOURCE_EXHAUSTED.*(limit: 0|billing)/i;
const MENSAJE_SIN_CUOTA = 'Tu clave de Gemini no tiene cuota para generar imágenes: los modelos de imagen son de pago y no tienen capa gratuita. Activa la facturación del proyecto de esa clave en Google AI Studio (https://aistudio.google.com) y vuelve a intentarlo.';

function errorDe(res, body, apiKey) {
  const msg = (body && body.error && (body.error.message || body.error)) || `HTTP ${res.status}`;
  return new Error(String(msg).split(apiKey).join('***').slice(0, 300));
}

// Busca en cualquier parte de la respuesta un bloque con una imagen en base64 (Interactions API: output_image, outputs o pasos «image»;
// generateContent: inlineData). Búsqueda en profundidad, para no depender de la forma exacta del JSON.
function buscarImagen(obj, prof = 0) {
  if (!obj || typeof obj !== 'object' || prof > 9) return null;
  if (typeof obj.data === 'string' && obj.data.length > 2000 && (obj.type === 'image' || /^image\//.test(obj.mime_type || obj.mimeType || '') || /^(iVBOR|\/9j\/|UklGR)/.test(obj.data))) {
    return { mime: obj.mime_type || obj.mimeType || (obj.data.startsWith('/9j/') ? 'image/jpeg' : 'image/png'), data: obj.data };
  }
  for (const v of Array.isArray(obj) ? obj : Object.values(obj)) {
    const r = buscarImagen(v, prof + 1);
    if (r) return r;
  }
  return null;
}

// Resumen de la forma de una respuesta (sin datos), para diagnosticar cuando no trae imagen
function forma(v, prof = 0) {
  if (Array.isArray(v)) return `[${v.length ? forma(v[0], prof + 1) : ''}]`;
  if (v && typeof v === 'object') return prof > 2 ? '{…}' : `{${Object.keys(v).slice(0, 8).map((k) => `${k}:${forma(v[k], prof + 1)}`).join(',')}}`;
  return typeof v === 'string' ? `str${v.length > 200 ? '(largo)' : ''}` : typeof v;
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const esPasajero = (st) => st === 429 || st === 500 || st === 503 || st === 504;
// Modelos de imagen por orden de preferencia (solo se recorre la lista si el usuario no eligió uno concreto)
const MODELOS = ['gemini-nano-banana-2.1', 'gemini-3.1-flash-image', 'gemini-3-pro-image'];

// Un intento con un modelo: primero la Interactions API y, si no la acepta, generateContent
async function intentar(apiKey, model, prompt) {
  let r = await llamar(`${BASE}/v1beta/interactions`, { 'Api-Revision': REVISION }, {
    model,
    input: prompt,
    response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '4:5', image_size: TAMANO }   // la API solo admite image/jpeg aquí
  }, apiKey);
  let via = 'interactions';
  if (!r.res.ok && [400, 404, 405, 501].includes(r.res.status)) {
    const primero = errorDe(r.res, r.body, apiKey).message;
    const r2 = await llamar(`${BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {}, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '4:5' } }
    }, apiKey);
    if (r2.res.ok) { r = r2; via = 'generateContent'; }
    else { const e = errorDe(r2.res, r2.body, apiKey); e.status = r2.res.status; e.message = `${primero} | ${e.message}`; throw e; }
  }
  if (!r.res.ok) { const e = errorDe(r.res, r.body, apiKey); e.status = r.res.status; throw e; }
  const img = buscarImagen(r.body);
  if (!img) {
    const texto = String(r.body && (r.body.output_text || '')).slice(0, 160);
    const e = new Error(`La IA no devolvió ninguna imagen (${via}; respuesta ${forma(r.body)})${texto ? `: ${texto}` : ''}`);
    e.sinImagen = true;
    throw e;
  }
  return { mime: img.mime, data: Buffer.from(img.data, 'base64'), model, via };
}

async function generarImagen(apiKey, model, prompt) {
  const lista = MODELOS.includes(model) ? [model, ...MODELOS.filter((m) => m !== model)] : [model];
  let ultimo;
  for (const m of lista) {
    for (let intento = 1; intento <= 2; intento++) {
      try {
        return await intentar(apiKey, m, prompt);
      } catch (e) {
        ultimo = e;
        console.error(`Imagen con ${m} (intento ${intento}):`, String(e.message).slice(0, 300));
        if (SIN_CUOTA.test(String(e.message))) { const q = new Error(MENSAJE_SIN_CUOTA + ' (Detalle de Google: ' + String(e.message).slice(0, 160) + ')'); q.status = 429; q.sinCuota = true; throw q; }   // no tiene sentido reintentar ni probar otros modelos
        if (e.status && esPasajero(e.status) && intento === 1) { await pausa(3000); continue; }   // saturado: un reintento
        break;                                                                                        // otro error: probar el siguiente modelo
      }
    }
    if (ultimo && ultimo.status && [401, 403].includes(ultimo.status)) break;                          // clave rechazada: no sirve probar más modelos
  }
  ultimo.message = `${ultimo.message}`.slice(0, 380);
  throw ultimo;
}

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const extDe = (mime) => EXT[mime] || 'png';

module.exports = { construirPromptImagen, generarImagen, buscarImagen, extDe, FIRMA };
