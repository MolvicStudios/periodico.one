// worker/index.js — Cloudflare Worker principal para Periodico.one
//
// Deploy:  cd worker/ && wrangler deploy
// Secrets: wrangler secret put GROQ_API_KEY
//          wrangler secret put NEWS_API_KEY
// KV:      wrangler kv:namespace create NOTICIAS_KV  →  copiar ID a wrangler.toml

const GROQ_ENDPOINT   = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL           = 'llama-3.3-70b-versatile'
const ALLOWED_ORIGINS = [
  'https://periodico.one',
  'https://www.periodico.one',
  'https://periodico-one.pages.dev'
]

// ── Fuentes RSS por sección (internacionales en español) ───
const RSS_SOURCES = {
  tecnologia: [
    'https://cnnespanol.cnn.com/category/tecnologia/feed/',
    'https://www.dw.com/es/rss/ciencia-y-tecnolog%C3%ADa/rss.xml',
    'https://rss.france24.com/rss/es/noticias',
    'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/tecnologia/portada',
    'https://www.infobae.com/feeds/rss/'
  ],
  economia: [
    'https://cnnespanol.cnn.com/category/economia/feed/',
    'https://www.dw.com/es/rss/econom%C3%ADa/rss.xml',
    'https://rss.france24.com/rss/es/economía',
    'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada',
    'https://www.infobae.com/feeds/rss/'
  ],
  politica: [
    'https://cnnespanol.cnn.com/category/mundo/feed/',
    'https://rss.france24.com/rss/es/noticias',
    'https://www.dw.com/es/rss/pol%C3%ADtica/rss.xml',
    'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/internacional/portada',
    'https://www.infobae.com/feeds/rss/'
  ],
  ciencia: [
    'https://cnnespanol.cnn.com/category/salud/feed/',
    'https://www.dw.com/es/rss/ciencia-y-tecnolog%C3%ADa/rss.xml',
    'https://rss.france24.com/rss/es/noticias',
    'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/ciencia/portada',
    'https://www.infobae.com/feeds/rss/'
  ],
  cultura: [
    'https://cnnespanol.cnn.com/category/entretenimiento/feed/',
    'https://rss.france24.com/rss/es/cultura',
    'https://www.dw.com/es/rss/cultura/rss.xml',
    'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/cultura/portada',
    'https://www.infobae.com/feeds/rss/'
  ]
}

// ── Protección SSRF: valida que la URL sea pública ─────────
function isAllowedUrl(urlStr) {
  try {
    const u    = new URL(urlStr)
    const host = u.hostname.toLowerCase()

    if (!['http:', 'https:'].includes(u.protocol))                    return false
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return false
    if (/^127\./.test(host))                                           return false
    if (/^10\./.test(host))                                            return false
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host))                     return false
    if (/^192\.168\./.test(host))                                      return false
    if (host === 'metadata.google.internal')                           return false
    if (host.endsWith('.internal') || host.endsWith('.local'))         return false

    return true
  } catch {
    return false
  }
}

// ── Parser RSS (XML → objetos) ─────────────────────────────
async function fetchRSS(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Periodico.one/1.0 RSS Reader' }
    })
    const xml   = await res.text()
    const items = []

    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
    for (const match of itemMatches) {
      const item    = match[1]
      const title   = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim()
      const link    = item.match(/<link>(.*?)<\/link>/)?.[1]?.trim()
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim()
      const desc    = item.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/)?.[1]
        ?.replace(/<[^>]+>/g, '')?.trim()?.slice(0, 200)
      const source  = new URL(url).hostname.replace('www.', '').replace('feeds.', '')

      if (title && link) items.push({ title, link, pubDate, desc, source })
    }

    return items.slice(0, 5)
  } catch {
    return []
  }
}

// ── NewsAPI por sección (noticias mundiales en español) ────
async function fetchNewsAPI(seccion, apiKey) {
  const queries = {
    tecnologia: 'tecnología OR inteligencia artificial OR startup OR innovación',
    economia:   'economía OR mercados OR finanzas OR inflación OR comercio',
    politica:   'política OR gobierno OR elecciones OR geopolítica OR conflicto',
    ciencia:    'ciencia OR investigación OR salud OR clima OR medio ambiente',
    cultura:    'cultura OR arte OR cine OR música OR entretenimiento'
  }
  try {
    const q   = encodeURIComponent(queries[seccion] || seccion)
    const url = `https://newsapi.org/v2/everything?q=${q}&language=es&sortBy=publishedAt&pageSize=10&apiKey=${apiKey}`
    const res = await fetch(url)
    const data = await res.json()
    return (data.articles || []).map(a => ({
      title:   a.title,
      link:    a.url,
      pubDate: a.publishedAt,
      desc:    a.description?.slice(0, 200),
      source:  a.source?.name || 'NewsAPI'
    }))
  } catch {
    return []
  }
}

// ── Deduplicar por título ──────────────────────────────────
function deduplicar(items) {
  const seen = new Set()
  return items.filter(item => {
    const key = item.title?.toLowerCase().slice(0, 40)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Cron: cachea noticias cada hora ───────────────────────
async function actualizarNoticias(env) {
  const secciones = Object.keys(RSS_SOURCES)

  for (const seccion of secciones) {
    const rssItems = (await Promise.all(
      RSS_SOURCES[seccion].map(url => fetchRSS(url))
    )).flat()

    const apiItems = await fetchNewsAPI(seccion, env.NEWS_API_KEY)
    const todos    = deduplicar([...rssItems, ...apiItems]).slice(0, 20)

    await env.NOTICIAS_KV.put(
      `noticias_${seccion}`,
      JSON.stringify({ items: todos, updated: new Date().toISOString() }),
      { expirationTtl: 7200 }
    )
  }
  console.log('[Periodico.one] Noticias actualizadas:', new Date().toISOString())
}

// ── Worker export ──────────────────────────────────────────
export default {

  // Trigger cron — cada hora en punto ("0 * * * *" en wrangler.toml)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(actualizarNoticias(env))
  },

  // Fetch handler — API para el frontend
  async fetch(request, env) {
    const url    = new URL(request.url)
    const origin = request.headers.get('Origin') || ''

    const corsHeaders = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // ── GET /noticias?seccion=tecnologia ──────────────────
    if (url.pathname === '/noticias' && request.method === 'GET') {
      const seccion = url.searchParams.get('seccion') || 'tecnologia'

      // Validar sección para evitar KV key inyección
      if (!RSS_SOURCES[seccion]) {
        return new Response(JSON.stringify({ error: 'Sección no válida' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const cached = await env.NOTICIAS_KV.get(`noticias_${seccion}`)
      if (cached) {
        return new Response(cached, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
        })
      }

      // Sin caché: fetchear ahora
      const rssItems = (await Promise.all(
        RSS_SOURCES[seccion].map(u => fetchRSS(u))
      )).flat()
      const apiItems = await fetchNewsAPI(seccion, env.NEWS_API_KEY)
      const todos    = deduplicar([...rssItems, ...apiItems]).slice(0, 20)
      const result   = { items: todos, updated: new Date().toISOString() }

      await env.NOTICIAS_KV.put(
        `noticias_${seccion}`,
        JSON.stringify(result),
        { expirationTtl: 7200 }
      )

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── GET /buscar?q=keyword ─────────────────────────────
    if (url.pathname === '/buscar' && request.method === 'GET') {
      const q = url.searchParams.get('q') || ''

      if (!q.trim()) {
        return new Response(JSON.stringify({ items: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      try {
        const apiUrl = `https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=es&sortBy=publishedAt&pageSize=10&apiKey=${env.NEWS_API_KEY}`
        const res    = await fetch(apiUrl)
        const data   = await res.json()
        const items  = (data.articles || []).map(a => ({
          title:   a.title,
          link:    a.url,
          pubDate: a.publishedAt,
          desc:    a.description?.slice(0, 200),
          source:  a.source?.name
        }))
        return new Response(JSON.stringify({ items }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } catch (e) {
        return new Response(JSON.stringify({ items: [], error: 'Error al buscar' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // ── POST /resumir — proxy Groq ─────────────────────────
    if (url.pathname === '/resumir' && request.method === 'POST') {
      let body
      try {
        body = await request.json()
      } catch {
        return new Response(JSON.stringify({ error: 'Cuerpo inválido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Límites de longitud para prevenir abuso
      const titulo = String(body.titulo      || '').slice(0, 500)
      const desc   = String(body.descripcion || '').slice(0, 1000)

      if (!titulo) {
        return new Response(JSON.stringify({ error: 'Título requerido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      try {
        const groqRes = await fetch(GROQ_ENDPOINT, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              {
                role: 'system',
                content: 'Eres un periodista neutral y objetivo. Resume noticias en 2-3 frases claras, sin sesgo político ni emocional. Solo los hechos esenciales. En español. Sin clickbait. Sin opinión.'
              },
              {
                role: 'user',
                content: `Resume esta noticia de forma neutral:\nTítulo: ${titulo}\nDescripción: ${desc || 'No disponible'}`
              }
            ],
            temperature: 0.3,
            max_tokens: 200
          })
        })

        const data   = await groqRes.json()
        const resumen = data.choices?.[0]?.message?.content || 'No se pudo generar el resumen.'

        return new Response(JSON.stringify({ resumen }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } catch {
        return new Response(JSON.stringify({ resumen: 'Error de conexión con el servicio de IA.' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    // ── GET /leer?url=... — proxy lectura limpia ───────────
    if (url.pathname === '/leer' && request.method === 'GET') {
      const targetUrl = url.searchParams.get('url')

      if (!targetUrl) {
        return new Response(JSON.stringify({ error: 'URL requerida' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Protección SSRF: solo URLs públicas permitidas
      if (!isAllowedUrl(targetUrl)) {
        return new Response(JSON.stringify({ error: 'URL no permitida' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      try {
        const pageRes = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Periodico.one/1.0; +https://periodico.one)',
            'Accept': 'text/html,application/xhtml+xml'
          }
        })

        const html = await pageRes.text()

        // Eliminación de bloques no deseados y etiquetas HTML
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
          .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&[a-z]+;|&#\d+;/gi, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
          .slice(0, 8000)

        return new Response(JSON.stringify({ text }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } catch {
        return new Response(JSON.stringify({ error: 'No se pudo acceder a la URL' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    return new Response('Not found', { status: 404 })
  }
}
