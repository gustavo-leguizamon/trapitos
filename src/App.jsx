import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { useGeolocation } from './hooks/useGeolocation'
import { toPointWKT, paddedRadius } from './lib/geo'
import MapView from './components/MapView'
import AddSpotForm from './components/AddSpotForm'
import ReputationBadge from './components/ReputationBadge'

export default function App() {
  const { position, error: geoError, loading: geoLoading } = useGeolocation()
  const [session, setSession] = useState(null)
  const [spots, setSpots] = useState([])
  const [pendingLocation, setPendingLocation] = useState(null)
  const [saving, setSaving] = useState(false)
  const [recenterTrigger, setRecenterTrigger] = useState(0)
  const [message, setMessage] = useState(null)
  const [reputation, setReputation] = useState(null)
  // Última área visible del mapa, para recargar tras agregar un trapito
  const lastViewRef = useRef(null)

  // --- Autenticación ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // --- Reputación del usuario logueado ---
  const loadReputation = useCallback(async () => {
    const { data, error } = await supabase.rpc('mi_reputacion')
    if (error || !data || !data[0]) return
    const r = data[0]
    setReputation({
      spotsCreados: Number(r.spots_creados),
      confirmacionesRecibidas: Number(r.confirmaciones_recibidas),
      desmentidosRecibidos: Number(r.desmentidos_recibidos),
      votosEmitidos: Number(r.votos_emitidos),
    })
  }, [])

  useEffect(() => {
    if (session) loadReputation()
    else setReputation(null)
  }, [session, loadReputation])

  // Login anónimo: el usuario participa sin crear cuenta
  async function signInAnonymously() {
    const { error } = await supabase.auth.signInAnonymously()
    if (error) setMessage('No se pudo iniciar sesión: ' + error.message)
  }

  // --- Cargar los trapitos del área visible del mapa ---
  const loadSpots = useCallback(async (view) => {
    if (!view) return
    lastViewRef.current = view
    const { data, error } = await supabase.rpc('spots_cercanos', {
      p_lat: view.lat,
      p_lng: view.lng,
      // un poco más que el radio visible, para incluir lo que está justo al borde
      p_radio_m: paddedRadius(view.radius),
    })
    if (error) {
      setMessage('Error al cargar trapitos: ' + error.message)
      return
    }
    setSpots(data || [])
  }, [])

  // --- Guardar un nuevo trapito ---
  async function handleSubmitSpot({ calle, descripcion }) {
    if (!session) {
      setMessage('Iniciá sesión para poder cargar un trapito.')
      return
    }
    setSaving(true)
    const { lat, lng } = pendingLocation
    const { error } = await supabase.from('trapito_spots').insert({
      lat,
      lng,
      // PostGIS espera el punto como WKT vía la columna geom
      geom: toPointWKT(lat, lng),
      calle: calle || null,
      descripcion: descripcion || null,
      created_by: session.user.id,
    })
    setSaving(false)

    if (error) {
      setMessage('No se pudo guardar: ' + error.message)
      return
    }
    setPendingLocation(null)
    setMessage('¡Trapito marcado! Gracias por colaborar 🙌')
    loadSpots(lastViewRef.current)
    loadReputation()
  }

  // --- Votar un trapito (confirmar / "ya no está") ---
  async function handleReport(spotId, tipo) {
    if (!session) {
      setMessage('Iniciá sesión para votar.')
      return
    }
    // Un voto por usuario y trapito: si ya votó, se actualiza (upsert)
    const { error } = await supabase.from('spot_reports').upsert(
      { spot_id: spotId, user_id: session.user.id, tipo },
      { onConflict: 'spot_id,user_id' }
    )
    if (error) {
      setMessage('No se pudo registrar tu voto: ' + error.message)
      return
    }
    setMessage(tipo === 'confirma' ? '¡Gracias! Confirmado 👍' : 'Gracias, lo marcamos 👎')
    loadSpots(lastViewRef.current)
    loadReputation()
  }

  return (
    <div className="app">
      <div className="map-wrap">
        <MapView
          userPosition={position}
          spots={spots}
          onMapClick={(loc) => setPendingLocation(loc)}
          recenterTrigger={recenterTrigger}
          onViewChange={loadSpots}
          canVote={!!session}
          onReport={handleReport}
        />
      </div>

      {/* Barra superior */}
      <header className="topbar">
        <span className="brand">🅿️ Trapitos</span>
        {!session ? (
          <button className="login-btn" onClick={signInAnonymously}>
            Participar
          </button>
        ) : (
          <ReputationBadge stats={reputation} />
        )}
      </header>

      {/* Botones flotantes */}
      <div className="fab-group">
        <button
          className="fab"
          title="Centrar en mi ubicación"
          onClick={() => setRecenterTrigger((t) => t + 1)}
        >
          🎯
        </button>
        <button
          className="fab primary"
          title="Marcar trapito en mi ubicación"
          onClick={() => {
            if (position) setPendingLocation(position)
            else setMessage('Esperando tu ubicación GPS…')
          }}
        >
          ＋
        </button>
      </div>

      {/* Ayuda contextual */}
      {!pendingLocation && (
        <div className="hint">Tocá el mapa o usá ＋ para marcar un trapito</div>
      )}

      {/* Hoja inferior para cargar */}
      {pendingLocation && (
        <AddSpotForm
          location={pendingLocation}
          onSubmit={handleSubmitSpot}
          onCancel={() => setPendingLocation(null)}
          saving={saving}
        />
      )}

      {/* Mensajes / errores */}
      {(message || geoError) && (
        <div className="toast" onClick={() => setMessage(null)}>
          {message || geoError}
        </div>
      )}

      {geoLoading && !position && <div className="toast">Buscando tu ubicación…</div>}
    </div>
  )
}
