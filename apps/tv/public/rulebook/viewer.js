(() => {
  const PAGE_WITH_DESK_WIDTH = 842

  const fitDocument = () => {
    const documentPage = document.querySelector('doc-page')
    if (!(documentPage instanceof HTMLElement)) return
    const availableWidth = Math.max(320, window.innerWidth - 8)
    documentPage.style.zoom = String(Math.min(1, availableWidth / PAGE_WITH_DESK_WIDTH))
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fitDocument, { once: true })
  } else {
    fitDocument()
  }
  window.addEventListener('resize', fitDocument, { passive: true })
})()
