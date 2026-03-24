// js/dark.js — Toggle de modo oscuro / claro

/**
 * Inicializa el toggle de dark mode.
 * Lee el tema guardado en localStorage al cargar.
 * Persiste la preferencia del usuario.
 */
export function initDarkMode() {
  const toggle = document.getElementById('dark-toggle')
  const saved  = localStorage.getItem('periodico_theme') || 'dark'

  // Aplicar tema guardado (sobreescribe el data-theme="dark" del HTML si el usuario
  // había seleccionado light anteriormente)
  document.body.dataset.theme = saved

  if (!toggle) return

  toggle.addEventListener('click', () => {
    const current = document.body.dataset.theme
    const next    = current === 'dark' ? 'light' : 'dark'
    document.body.dataset.theme = next
    localStorage.setItem('periodico_theme', next)
  })
}
