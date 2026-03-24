// js/cookies.js
const COOKIE_KEY = 'periodico_cookie_consent'

function getCookieConsent() {
  return localStorage.getItem(COOKIE_KEY)
}

function setCookieConsent(value) {
  // value: 'all' | 'necessary' | 'pending'
  localStorage.setItem(COOKIE_KEY, value)
}

function hideBanner() {
  const banner = document.getElementById('cookie-banner')
  if (banner) banner.style.display = 'none'
}

function acceptAllCookies() {
  setCookieConsent('all')
  hideBanner()
  // Aquí activar analytics si los hay
}

function acceptNecessaryCookies() {
  setCookieConsent('necessary')
  hideBanner()
}

function openCookieConfig() {
  document.getElementById('cookie-config-panel').style.display = 'flex'
}

function saveCookieConfig() {
  const analytics = document.getElementById('cookie-analytics')?.checked
  const marketing = document.getElementById('cookie-marketing')?.checked
  setCookieConsent(analytics || marketing ? 'custom' : 'necessary')
  document.getElementById('cookie-config-panel').style.display = 'none'
  hideBanner()
}

// Mostrar banner solo si no hay decisión tomada
document.addEventListener('DOMContentLoaded', () => {
  if (!getCookieConsent()) {
    const banner = document.getElementById('cookie-banner')
    if (banner) banner.style.display = 'flex'
  }
})

// Exponer funciones globalmente
window.acceptAllCookies = acceptAllCookies
window.acceptNecessaryCookies = acceptNecessaryCookies
window.openCookieConfig = openCookieConfig
window.saveCookieConfig = saveCookieConfig
