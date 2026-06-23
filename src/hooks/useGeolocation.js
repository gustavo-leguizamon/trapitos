import { useEffect, useState } from 'react'

// Obtiene y observa la ubicación del usuario vía la API de geolocalización del navegador.
export function useGeolocation() {
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Tu dispositivo no soporta geolocalización.')
      setLoading(false)
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLoading(false)
      },
      (err) => {
        setError(err.message || 'No pudimos obtener tu ubicación.')
        setLoading(false)
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  return { position, error, loading }
}
