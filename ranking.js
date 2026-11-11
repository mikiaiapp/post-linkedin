// Ordena las noticias por impacto en las últimas 24 horas.
// Impacto = cuántos diarios distintos cubren el mismo tema (titulares parecidos) + frescura + palabras de alto impacto económico.
// Las noticias de más de 24 horas (o sin fecha) van después, de más reciente a más antigua.
const STOP = new Set(['para', 'como', 'pero', 'sobre', 'entre', 'desde', 'hasta', 'tras', 'este', 'esta', 'estos', 'estas', 'cuando', 'donde', 'tiene', 'tienen', 'hace', 'hacen', 'será', 'serán', 'está', 'están', 'sido', 'puede', 'pueden', 'según', 'ante', 'bajo', 'contra', 'durante', 'cada', 'otro', 'otra', 'otros', 'otras', 'más', 'menos', 'muy', 'también', 'solo', 'sólo', 'porque', 'aunque', 'además', 'hoy', 'ayer', 'después', 'antes', 'primer', 'primera', 'nuevo', 'nueva', 'nuevos', 'nuevas', 'año', 'años', 'dice', 'afirma', 'asegura', 'cómo', 'qué', 'por', 'que', 'una', 'uno', 'unos', 'unas', 'los', 'las', 'del', 'con', 'sin', 'ser', 'son', 'fue', 'han', 'sus', 'its', 'the']);

// Palabras que suelen indicar una noticia de gran impacto económico (se comparan sin tildes y en minúsculas)
const IMPACTO = ['ipc', 'inflacion', 'bce', 'fed', 'tipos de interes', 'euribor', 'aranceles', 'arancel', 'deuda', 'pib', 'recesion', 'crisis', 'paro', 'desempleo', 'deficit', 'pensiones', 'ibex', 'bolsa', 'petroleo', 'brent', 'gas', 'banco de espana', 'hacienda', 'impuestos', 'irpf', 'iva', 'salario', 'smi', 'quiebra', 'rescate', 'sanciones', 'guerra', 'opa', 'fusion', 'despidos', 'ere', 'prima de riesgo', 'bono', 'dolar', 'euro', 'oro', 'acero', 'energia', 'vivienda', 'hipoteca', 'alquiler'];

const SIGLAS = new Set(['ipc', 'bce', 'fed', 'pib', 'ere', 'opa', 'smi', 'iva', 'ue', 'eeuu', 'ibex']);   // siglas de 3 letras o menos que sí cuentan como tema

const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function tokens(titulo) {
  // Palabras de 4+ letras reducidas a su raíz (4 letras: china/chino, arancel/aranceles) y cifras de 2+ dígitos (el 50 de «50%»)
  const out = new Set();
  for (const t of sinTildes(titulo).replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)) {
    if (/^\d{2,}$/.test(t)) out.add(t);
    else if ((t.length > 3 || SIGLAS.has(t)) && !STOP.has(t)) out.add(t.slice(0, 4));
  }
  return out;
}

function similares(a, b) {
  if (!a.size || !b.size) return false;
  let comunes = 0;
  for (const t of a) if (b.has(t)) comunes++;
  return comunes >= 2 && comunes / Math.min(a.size, b.size) >= 0.3;
}

/**
 * @param {Array} noticias  [{sourceName, title, pubDate, snippet, ...}]
 * @param {number} [ahora]  instante de referencia (ms), para pruebas
 * @returns {Array} las mismas noticias con `impacto: {puntos, diarios, reciente}` y ordenadas
 */
function ordenarPorImpacto(noticias, ahora = Date.now()) {
  const VENTANA = 24 * 3600 * 1000;
  const items = noticias.map((n) => {
    const t = n.pubDate ? new Date(n.pubDate).getTime() : NaN;
    return { n, tokens: tokens(n.title), t: Number.isNaN(t) ? null : t };
  });

  // Agrupa por tema entre las noticias de las últimas 24 h (un tema = titulares parecidos de diarios distintos)
  const recientes = items.filter((i) => i.t !== null && ahora - i.t <= VENTANA && i.t <= ahora + 3600 * 1000);
  const diarios = new Map(recientes.map((i) => [i, new Set([i.n.sourceName])]));
  for (let x = 0; x < recientes.length; x++) {
    for (let y = x + 1; y < recientes.length; y++) {
      if (recientes[x].n.sourceName !== recientes[y].n.sourceName && similares(recientes[x].tokens, recientes[y].tokens)) {
        diarios.get(recientes[x]).add(recientes[y].n.sourceName);
        diarios.get(recientes[y]).add(recientes[x].n.sourceName);
      }
    }
  }

  for (const i of items) {
    const esReciente = recientes.includes(i);
    if (!esReciente) { i.n.impacto = { puntos: 0, diarios: 1, reciente: false }; continue; }
    const cobertura = diarios.get(i).size;                                   // diarios que hablan de lo mismo
    const frescura = 5 * (1 - (ahora - i.t) / VENTANA);                      // 5 puntos si es de ahora, 0 si tiene 24 h
    const texto = sinTildes(`${i.n.title} ${i.n.snippet || ''}`);
    const palabras = Math.min(4, IMPACTO.filter((p) => new RegExp(`(^|[^a-z])${p}([^a-z]|$)`).test(texto)).length);
    i.n.impacto = { puntos: Math.round((cobertura * 10 + frescura + palabras * 2) * 10) / 10, diarios: cobertura, reciente: true };
  }

  return items
    .map((i) => ({ ...i.n, _t: i.t }))
    .sort((a, b) => {
      if (a.impacto.reciente !== b.impacto.reciente) return a.impacto.reciente ? -1 : 1;
      if (a.impacto.reciente) return b.impacto.puntos - a.impacto.puntos || b._t - a._t;
      return (b._t || 0) - (a._t || 0);
    })
    .map(({ _t, ...n }) => n);
}

module.exports = { ordenarPorImpacto };
