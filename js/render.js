// js/render.js — Renderizado de noticias con seguridad XSS

import { timeAgo } from './news.js'

const SECCION_COLORS = {
  tecnologia: 'var(--color-tech)',
  economia:   'var(--color-eco)',
  politica:   'var(--color-pol)',
  ciencia:    'var(--color-sci)',
  cultura:    'var(--color-cul)'
}

const SECCION_LABELS = {
  tecnologia: 'Tecnología e IA',
  economia:   'Economía',
  politica:   'Política',
  ciencia:    'Ciencia',
  cultura:    'Cultura'
}

/**
 * Escapa caracteres HTML para prevenir XSS en contenido RSS externo.
 * @param {*} str
 * @returns {string}
 */
function esc(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Renderiza la cuadrícula de noticias (destacada + grid).
 * @param {Array}  noticias
 * @param {string} seccion
 * @param {HTMLElement} container
 */
export function renderGrid(noticias, seccion, container) {
  if (!noticias || !noticias.length) {
    container.innerHTML = '<div class="empty-state"><p>No hay noticias disponibles.</p><p>Las noticias se actualizan cada hora.</p></div>'
    return
  }

  const [destacada, ...resto] = noticias
  const color = SECCION_COLORS[seccion] || 'var(--color-tech)'
  const label = SECCION_LABELS[seccion] || seccion

  // Construir HTML sin inline onclick handlers — se usarán data-action + event delegation
  container.innerHTML = `
    <article class="news-featured"
      data-titulo="${esc(destacada.title)}"
      data-desc="${esc(destacada.desc || '')}">
      <div class="news-meta">
        <span class="news-section-badge" style="background:${color}20;color:${color}">${esc(label)}</span>
        <span class="news-source">${esc(destacada.source)}</span>
        <span class="news-time">${timeAgo(destacada.pubDate)}</span>
      </div>
      <h2 class="news-featured-title">${esc(destacada.title)}</h2>
      ${destacada.desc ? `<p class="news-excerpt">${esc(destacada.desc)}</p>` : ''}
      <div class="news-actions">
        <a href="${esc(destacada.link)}" target="_blank" rel="noopener noreferrer" class="btn-read">Leer →</a>
        <button class="btn-summarize" data-action="summarize">Resumir con IA</button>
        <button class="btn-reader" data-action="reader" data-url="${esc(destacada.link)}">Vista limpia</button>
        <a href="https://veridex.quest/?q=${encodeURIComponent(destacada.title)}" target="_blank" rel="noopener noreferrer" class="btn-verify">Verificar ↗</a>
      </div>
      <div class="news-summary-box" style="display:none"></div>
    </article>

    <div class="news-grid">
      ${resto.map(item => buildCard(item)).join('')}
    </div>
  `

  // Event delegation — un único listener por renderizado
  container.querySelectorAll('[data-action="summarize"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const article = btn.closest('article')
      handleSummarize(btn, article)
    })
  })

  container.querySelectorAll('[data-action="reader"]').forEach(btn => {
    btn.addEventListener('click', () => handleReader(btn.dataset.url))
  })
}

/**
 * Construye el HTML de una tarjeta de noticia individual.
 * @param {Object} item
 * @returns {string}
 */
function buildCard(item) {
  return `
    <article class="news-card"
      data-titulo="${esc(item.title)}"
      data-desc="${esc(item.desc || '')}">
      <div class="news-meta">
        <span class="news-source">${esc(item.source)}</span>
        <span class="news-time">${timeAgo(item.pubDate)}</span>
      </div>
      <h3 class="news-card-title">${esc(item.title)}</h3>
      <div class="news-card-actions">
        <a href="${esc(item.link)}" target="_blank" rel="noopener noreferrer" class="btn-read-sm">Leer →</a>
        <button class="btn-summarize-sm" data-action="summarize" title="Resumir con IA">IA</button>
        <button class="btn-reader-sm" data-action="reader" data-url="${esc(item.link)}" title="Vista limpia">📖</button>
        <a href="https://veridex.quest/?q=${encodeURIComponent(item.title)}" target="_blank" rel="noopener noreferrer" class="btn-verify-sm" title="Verificar con Veridex">✓</a>
      </div>
      <div class="news-summary-box" style="display:none"></div>
    </article>
  `
}

/**
 * Genera un resumen IA para el artículo indicado.
 * Los datos provienen de data attributes (ya HTML-decoded por el browser).
 * @param {HTMLElement} btn
 * @param {HTMLElement} article
 */
async function handleSummarize(btn, article) {
  const titulo = article.dataset.titulo || ''
  const desc   = article.dataset.desc || ''
  const box    = article.querySelector('.news-summary-box')
  const isMain = btn.classList.contains('btn-summarize')
  const idleLabel = isMain ? 'Resumir con IA' : 'IA'

  btn.textContent = 'Resumiendo...'
  btn.disabled = true
  box.style.display = 'block'
  box.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>'

  try {
    const { resumirNoticia } = await import('./news.js')
    const resumen = await resumirNoticia(titulo, desc)
    box.innerHTML = `
      <div class="ai-indicator">
        <span class="ai-badge">✦ Generado por IA</span>
        <span class="ai-disclaimer">Resultado orientativo — verifica antes de usar</span>
      </div>
      <div class="summary-content"><strong>Resumen IA</strong>${esc(resumen)}</div>
      <div class="share-block">
        <span class="share-label">Compartir resultado:</span>
        <button class="btn-share-wa" onclick="shareWhatsApp()">WhatsApp</button>
        <button class="btn-share-tw" onclick="shareTwitter()">Twitter / X</button>
        <button class="btn-share-copy" onclick="shareURL()">Copiar enlace</button>
      </div>
      <div class="feedback-block">
        <span class="feedback-label">¿Ha sido útil este resultado?</span>
        <button class="btn-feedback" onclick="sendFeedback('positive', this)" title="Sí, útil">👍</button>
        <button class="btn-feedback" onclick="sendFeedback('negative', this)" title="Mejorable">👎</button>
        <div class="feedback-comment" style="display:none">
          <input type="text" placeholder="¿Qué podría mejorar? (opcional)">
          <button onclick="submitFeedback(this)">Enviar</button>
        </div>
        <span class="feedback-thanks" style="display:none">¡Gracias por tu opinión! 🙏</span>
      </div>
    `
  } catch {
    box.innerHTML = '<div class="summary-error">Error al generar resumen. Inténtalo de nuevo.</div>'
  } finally {
    btn.textContent = idleLabel
    btn.disabled = false
  }
}

// ── Share functions ──
function getShareText() {
  return encodeURIComponent('Lee las noticias del mundo sin sesgos en Periodico.one')
}

function getShareURL() {
  return encodeURIComponent(window.location.href)
}

window.shareWhatsApp = function() {
  window.open(`https://wa.me/?text=${getShareText()}%20${getShareURL()}`, '_blank')
}

window.shareTwitter = function() {
  window.open(`https://twitter.com/intent/tweet?text=${getShareText()}&url=${getShareURL()}`, '_blank')
}

window.shareURL = function() {
  navigator.clipboard.writeText(window.location.href)
    .then(() => showToast('¡Enlace copiado!'))
}

function showToast(msg) {
  const t = document.createElement('div')
  t.className = 'toast-msg'
  t.textContent = msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 2500)
}

// ── Feedback functions ──
window.sendFeedback = function(type, btn) {
  const block = btn.closest('.feedback-block')
  const key = 'periodico_feedback'
  const data = { type, url: window.location.href, ts: Date.now() }
  const existing = JSON.parse(localStorage.getItem(key) || '[]')
  existing.push(data)
  localStorage.setItem(key, JSON.stringify(existing.slice(-20)))

  if (type === 'negative') {
    const comment = block.querySelector('.feedback-comment')
    if (comment) comment.style.display = 'flex'
  } else {
    block.innerHTML = '<span class="feedback-thanks">¡Gracias por tu opinión! 🙏</span>'
  }
}

window.submitFeedback = function(btn) {
  const block = btn.closest('.feedback-block')
  block.innerHTML = '<span class="feedback-thanks">¡Gracias! Tu opinión nos ayuda a mejorar 🙏</span>'
}

/**
 * Abre la vista de lectura limpia para una URL.
 * @param {string} url
 */
async function handleReader(url) {
  const modal   = document.getElementById('reader-modal')
  const content = document.getElementById('reader-content')
  if (!modal || !content) return

  modal.style.display = 'flex'
  content.innerHTML = '<div class="loading-text">Cargando vista limpia...</div>'

  try {
    const { leerNoticia } = await import('./news.js')
    const text     = await leerNoticia(url)
    // Escape content and convert newlines to <br> to prevent XSS
    const safeText = esc(text).replace(/\n/g, '<br>')
    content.innerHTML = `
      <div class="reader-text">${safeText}</div>
      <a href="${esc(url)}" target="_blank" rel="noopener noreferrer" class="reader-source-link">Ver artículo original →</a>
    `
  } catch {
    content.innerHTML = '<div class="reader-error">No se pudo cargar la vista limpia de este artículo.</div>'
  }
}
