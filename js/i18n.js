// js/i18n.js — Strings en español para la UI

export const I18N = {
  secciones: {
    tecnologia: 'Tecnología e IA',
    economia:   'Economía',
    politica:   'Política',
    ciencia:    'Ciencia',
    cultura:    'Cultura'
  },

  ui: {
    resumir:     'Resumir con IA',
    resumiendo:  'Resumiendo...',
    leer:        'Leer →',
    vistaLimpia: 'Vista limpia',
    verificar:   'Verificar ↗',
    buscar:      'Buscar noticias...',
    cerrar:      '✕ Cerrar',
    reintentar:  '↺ Reintentar'
  },

  tiempo: {
    ahoraMismo: 'ahora mismo',
    haceMin:    (m)  => `hace ${m} min`,
    haceHoras:  (h)  => `hace ${h}h`,
    haceDias:   (d)  => `hace ${d}d`
  },

  estados: {
    cargando:      'Cargando...',
    buscando:      'Buscando...',
    sinNoticias:   'No hay noticias disponibles.',
    errorCargar:   'Error al cargar las noticias. Inténtalo de nuevo.',
    cargandoVista: 'Cargando vista limpia...',
    errorVista:    'No se pudo cargar la vista limpia de este artículo.',
    errorResumen:  'Error al generar resumen. Inténtalo de nuevo.',
    actualizadoAhora: 'Actualizado ahora',
    actualizadoHace:  (m) => `Actualizado hace ${m} min`
  }
}
