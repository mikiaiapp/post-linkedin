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

function errorDe(res, body, apiKey) {
  const msg = (body && body.error && (body.error.message || body.error)) || `HTTP ${res.status}`;
  return new Error(String(msg).split(apiKey).join('***').slice(0, 300));
}

// Busca la imagen en la respuesta de la Interactions API (output_image o bloques «image» de los pasos) o en la de generateContent
function extraerImagen(body) {
  if (!body) return null;
  if (body.output_image && body.output_image.data) return { mime: body.output_image.mime_type || 'image/png', data: body.output_image.data };
  for (const step of body.steps || []) {
    for (const b of step.content || []) if (b && b.type === 'image' && b.data) return { mime: b.mime_type || 'image/png', data: b.data };
  }
  const parts = (((body.candidates || [])[0] || {}).content || {}).parts || [];
  const img = parts.map((p) => p.inlineData || p.inline_data).find((x) => x && x.data);
  return img ? { mime: img.mimeType || img.mime_type || 'image/png', data: img.data } : null;
}

async function generarImagen(apiKey, model, prompt) {
  let { res, body } = await llamar(`${BASE}/v1beta/interactions`, { 'Api-Revision': REVISION }, {
    model,
    input: prompt,
    response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: '4:5', image_size: TAMANO }
  }, apiKey);

  if (res.status === 404 || res.status === 405) {
    ({ res, body } = await llamar(`${BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {}, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '4:5' } }
    }, apiKey));
  }
  if (!res.ok) throw errorDe(res, body, apiKey);

  const img = extraerImagen(body);
  if (!img) {
    const texto = String(body && body.output_text || '').slice(0, 200);
    throw new Error(`La IA no devolvió ninguna imagen${texto ? `: ${texto}` : ''}`);
  }
  return { mime: img.mime, data: Buffer.from(img.data, 'base64') };
}

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const extDe = (mime) => EXT[mime] || 'png';

module.exports = { construirPromptImagen, generarImagen, extDe, FIRMA };
