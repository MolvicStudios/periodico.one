// js/search.js — Módulo de búsqueda de noticias

import { buscarNoticias } from './news.js'
import { renderGrid } from './render.js'

/**
 * Inicializa el buscador de la navbar.
 * @param {() => string} getSeccion — función que devuelve la sección actual
 */
export function initSearch(getSeccion) {
  const searchInput = document.getElementById('search-input')
  const searchBtn   = document.getElementById('search-btn')

  if (!searchInput || !searchBtn) return

  async function doSearch() {
    const q = searchInput.value.trim()
    if (!q) return

    const container = document.getElementById('news-container')
    container.innerHTML = '<div class="loading-text">Buscando...</div>'

    try {
      const { items } = await buscarNoticias(q)
      renderGrid(items, getSeccion(), container)
    } catch {
      container.innerHTML = `
        <div class="error-state">
          <p>Error al buscar noticias.</p>
          <button id="retry-btn">↺ Reintentar</button>
        </div>
      `
      document.getElementById('retry-btn')?.addEventListener('click', doSearch)
    }
  }

  searchBtn.addEventListener('click', doSearch)
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch()
  })
}
