import { useEffect, useState } from 'react'

// Expone si la app se puede instalar y una función para disparar el prompt.
// El evento beforeinstallprompt solo lo emiten navegadores Chromium (Android/desktop)
// cuando se cumplen los criterios de PWA instalable. En iOS no existe: ahí se instala
// con "Compartir → Agregar a inicio".
export function usePwaInstall() {
  const [deferred, setDeferred] = useState(null)
  const [installed, setInstalled] = useState(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    return Boolean(standalone)
  })

  useEffect(() => {
    function onBeforePrompt(e) {
      e.preventDefault() // evita el mini-infobar para mostrar nuestro botón
      setDeferred(e)
    }
    function onInstalled() {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onBeforePrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforePrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function promptInstall() {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice
    setDeferred(null) // el prompt no se puede reutilizar
  }

  return { canInstall: Boolean(deferred) && !installed, promptInstall, installed }
}
