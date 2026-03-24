// js/app.js — Entry point, inicialización y router

import { fetchNoticias } from './news.js'
import { renderGrid } from './render.js'
import { initDarkMode } from './dark.js'
import { initSearch } from './search.js'
import { initReader } from './reader.js'

let seccionActual = 'tecnologia'

/**
 * Carga y renderiza las noticias de una sección.
 * Exportada y registrada globalmente para los footer links.
 * @param {string} seccion
 */
export async function loadSeccion(seccion) {
  seccionActual = seccion

  // Actualizar tabs activos
  document.querySelectorAll('.section-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.seccion === seccion)
  })

  const container = document.getElementById('news-container')
  container.innerHTML = `
    <div class="skeleton-featured"></div>
    <div class="skeleton-grid">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  `

  try {
    const { items, updated } = await fetchNoticias(seccion)
    renderGrid(items, seccion, container)

    // Actualizar indicador de tiempo
    const updateEl = document.getElementById('update-time')
    if (updateEl && updated) {
      const mins = Math.floor((Date.now() - new Date(updated).getTime()) / 60_000)
      updateEl.textContent = mins < 1 ? 'Actualizado ahora' : `Actualizado hace ${mins} min`
    }
  } catch (err) {
    console.error('[Periodico.one] Error cargando sección:', err)
    const container = document.getElementById('news-container')
    container.innerHTML = `
      <div class="error-state">
        <p>Error al cargar las noticias. Inténtalo de nuevo.</p>
        <button id="retry-btn">↺ Reintentar</button>
      </div>
    `
    document.getElementById('retry-btn')?.addEventListener('click', () => loadSeccion(seccion))
  }
}

// ── Inicialización ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Cargar sección inicial
  loadSeccion('tecnologia')

  // Tabs de sección
  document.querySelectorAll('.section-tab').forEach(tab => {
    tab.addEventListener('click', () => loadSeccion(tab.dataset.seccion))
  })

  // Links de footer (data-footer-seccion)
  document.querySelectorAll('[data-footer-seccion]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault()
      loadSeccion(link.dataset.footerSeccion)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  })

  // Módulos funcionales
  initDarkMode()
  initSearch(() => seccionActual)
  initReader()

  // Exponer loadSeccion globalmente para compatibilidad
  window.loadSeccion = loadSeccion

  // Auto-refresh cada hora
  setInterval(() => loadSeccion(seccionActual), 3_600_000)
})
