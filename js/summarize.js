// js/summarize.js — Módulo de resumen IA (standalone)
// Este módulo expone la lógica de resumen para uso externo.
// En la app principal el resumen se gestiona desde render.js.

import { resumirNoticia } from './news.js'

/**
 * Dispara un resumen IA para un artículo dado.
 * @param {HTMLElement} btn      — botón que activó la acción
 * @param {HTMLElement} article  — elemento <article> padre
 */
export async function summarize(btn, article) {
  const titulo    = article.dataset.titulo || ''
  const desc      = article.dataset.desc   || ''
  const box       = article.querySelector('.news-summary-box')
  const isMain    = btn.classList.contains('btn-summarize')
  const idleLabel = isMain ? 'Resumir con IA' : 'IA'

  if (!box) return

  btn.textContent = 'Resumiendo...'
  btn.disabled    = true
  box.style.display = 'block'
  box.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>'

  try {
    const resumen = await resumirNoticia(titulo, desc)
    box.innerHTML = `
      <div class="summary-content">
        <strong>Resumen IA</strong>
        ${resumen.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </div>
    `
  } catch {
    box.innerHTML = '<div class="summary-error">Error al generar resumen. Inténtalo de nuevo.</div>'
  } finally {
    btn.textContent = idleLabel
    btn.disabled    = false
  }
}
