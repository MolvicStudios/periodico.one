// js/reader.js — Módulo de vista de lectura limpia

/**
 * Inicializa el modal de lectura limpia:
 * - Cierra al hacer clic en el overlay
 * - Cierra al hacer clic en el botón cerrar
 * - Cierra con la tecla Escape
 */
export function initReader() {
  const modal    = document.getElementById('reader-modal')
  const overlay  = document.querySelector('.reader-overlay')
  const closeBtn = document.getElementById('reader-close-btn')

  if (!modal) return

  function closeReader() {
    modal.style.display = 'none'
    document.getElementById('reader-content').innerHTML = ''
  }

  overlay?.addEventListener('click', closeReader)
  closeBtn?.addEventListener('click', closeReader)

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.style.display !== 'none') {
      closeReader()
    }
  })
}
