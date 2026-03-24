// js/news.js — Fetch de noticias del Worker

const API_BASE = 'https://periodico-one.josemmolera.workers.dev'

/**
 * Obtiene noticias de una sección desde el Worker/KV cache.
 * @param {string} seccion
 * @returns {Promise<{items: Array, updated: string}>}
 */
export async function fetchNoticias(seccion = 'tecnologia') {
  const res = await fetch(`${API_BASE}/noticias?seccion=${encodeURIComponent(seccion)}`)
  if (!res.ok) throw new Error(`Error ${res.status} al cargar noticias`)
  return await res.json()
}

/**
 * Busca noticias por keyword vía NewsAPI proxy en el Worker.
 * @param {string} query
 * @returns {Promise<{items: Array}>}
 */
export async function buscarNoticias(query) {
  if (!query.trim()) return { items: [] }
  const res = await fetch(`${API_BASE}/buscar?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(`Error ${res.status} al buscar noticias`)
  return await res.json()
}

/**
 * Genera un resumen IA de una noticia vía proxy Groq en el Worker.
 * @param {string} titulo
 * @param {string} descripcion
 * @returns {Promise<string>}
 */
export async function resumirNoticia(titulo, descripcion) {
  const res = await fetch(`${API_BASE}/resumir`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo, descripcion })
  })
  if (!res.ok) throw new Error(`Error ${res.status} al resumir noticia`)
  const data = await res.json()
  return data.resumen || 'No se pudo generar el resumen.'
}

/**
 * Obtiene el texto limpio de un artículo externo vía proxy en el Worker.
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function leerNoticia(url) {
  const res = await fetch(`${API_BASE}/leer?url=${encodeURIComponent(url)}`)
  if (!res.ok) throw new Error(`Error ${res.status} al leer artículo`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.text || ''
}

/**
 * Formatea una fecha en tiempo relativo en español.
 * @param {string} dateStr
 * @returns {string}
 */
export function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  if (isNaN(diff) || diff < 0) return ''
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'ahora mismo'
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `hace ${days}d`
  return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
