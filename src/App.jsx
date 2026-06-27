import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { useGeolocation } from './hooks/useGeolocation'
import { useProximityNotifications } from './hooks/useProximityNotifications'
import { usePwaInstall } from './hooks/usePwaInstall'
import { toPointWKT, toLineWKT, paddedRadius } from './lib/geo'
import { getBlockForPoint } from './lib/street'
import { franjaFromDate } from './lib/schedule'
import MapView from './components/MapView'
import AddSpotForm from './components/AddSpotForm'
import ReputationBadge from './components/ReputationBadge'

export default function App() {
  const { position, error: geoError, loading: geoLoading } = useGeolocation()
  const [session, setSession] = useState(null)
  const [spots, setSpots] = useState([])
  const [pendingLocation, setPendingLocation] = useState(null)
  // Cuadra detectada (OSM) para la ubicación pendiente, y si se está buscando.
  const [pendingBlock, setPendingBlock] = useState(null)
  const [blockLoading, setBlockLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recenterTrigger, setRecenterTrigger] = useState(0)
  const [message, setMessage] = useState(null)
  const [reputation, setReputation] = useState(null)
  const [notifEnabled, setNotifEnabled] = useState(
    () => localStorage.getItem('notifProximidad') === '1'
  )
  const [verCaducados, setVerCaducados] = useState(false)
  // Última área visible del mapa, para recargar tras agregar un trapito
  const lastViewRef = useRef(null)
  // Espejo en ref para que loadSpots (estable) lea el valor actual sin recrearse
  const verCaducadosRef = useRef(false)
  // Timeout para ocultar el aviso de notificaciones activadas
  const notifMsgTimeoutRef = useRef(null)

  // Notificaciones de proximidad a trapitos cercanos
  useProximityNotifications(position, spots, notifEnabled)

  // Limpiar el timeout del aviso de notificaciones al desmontar
  useEffect(() => () => clearTimeout(notifMsgTimeoutRef.current), [])

  // Instalación de la PWA
  const { canInstall, promptInstall } = usePwaInstall()

  // --- Detectar la cuadra (OSM) de la ubicación pendiente ---
  // Al elegir un punto, consultamos OpenStreetMap el tramo de calle por el que
  // anda el trapito. Si falla, queda en null y se marca solo el punto (o se
  // puede reintentar). Guardamos la promesa en curso para que el alta la espere
  // y no termine guardando "solo el punto" por apurarse.
  const blockPromiseRef = useRef(null)

  const detectarCuadra = useCallback((loc) => {
    setPendingBlock(null)
    setBlockLoading(true)
    const p = getBlockForPoint(loc.lat, loc.lng)
      .catch(() => null)
      .then((b) => {
        // Solo aplicamos el resultado si sigue siendo la búsqueda vigente.
        if (blockPromiseRef.current === p) {
          setPendingBlock(b)
          setBlockLoading(false)
        }
        return b
      })
    blockPromiseRef.current = p
    return p
  }, [])

  useEffect(() => {
    if (!pendingLocation) {
      setPendingBlock(null)
      setBlockLoading(false)
      blockPromiseRef.current = null
      return
    }
    detectarCuadra(pendingLocation)
  }, [pendingLocation, detectarCuadra])

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

  // Activar/desactivar notificaciones de proximidad (pide permiso al activar)
  async function toggleNotificaciones() {
    if (notifEnabled) {
      setNotifEnabled(false)
      localStorage.removeItem('notifProximidad')
      // Al apagar la campana, ocultar el aviso
      clearTimeout(notifMsgTimeoutRef.current)
      setMessage(null)
      return
    }
    if (typeof Notification === 'undefined') {
      setMessage('Tu navegador no soporta notificaciones.')
      return
    }
    let permiso = Notification.permission
    if (permiso === 'default') permiso = await Notification.requestPermission()
    if (permiso !== 'granted') {
      setMessage('Activá el permiso de notificaciones para recibir avisos.')
      return
    }
    setNotifEnabled(true)
    localStorage.setItem('notifProximidad', '1')
    setMessage('Te avisaremos cuando estés cerca de un trapito 🔔')
    // Ocultar el aviso automáticamente luego de unos segundos
    clearTimeout(notifMsgTimeoutRef.current)
    notifMsgTimeoutRef.current = setTimeout(() => setMessage(null), 4000)
  }

  // Mostrar u ocultar los trapitos caducados en el mapa
  function toggleVerCaducados() {
    const nuevo = !verCaducados
    setVerCaducados(nuevo)
    verCaducadosRef.current = nuevo
    loadSpots(lastViewRef.current)
  }

  // Reactivar un trapito caducado (lo veo de nuevo ahora)
  async function handleReactivar(spotId) {
    if (!session) {
      setMessage('Iniciá sesión para reactivar.')
      return
    }
    const { data, error } = await supabase.rpc('reactivar_trapito', {
      p_spot_id: spotId,
      p_franjas: [franjaFromDate()],
    })
    if (error) {
      setMessage('No se pudo reactivar: ' + error.message)
      return
    }
    if (!data) {
      setMessage('Ese trapito ya no se puede reactivar.')
      return
    }
    setMessage('¡Trapito reactivado! Gracias 🙌')
    loadSpots(lastViewRef.current)
    loadReputation()
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
      p_incluir_inactivos: verCaducadosRef.current,
    })
    if (error) {
      setMessage('Error al cargar trapitos: ' + error.message)
      return
    }
    setSpots(data || [])
  }, [])

  // --- Guardar un nuevo trapito ---
  async function handleSubmitSpot({ calle, descripcion, franjas }) {
    if (!session) {
      setMessage('Iniciá sesión para poder cargar un trapito.')
      return
    }
    setSaving(true)
    // Esperamos a que termine la detección de la cuadra (si sigue en curso),
    // así no guardamos "solo el punto" por adelantarnos al proceso.
    const block = blockPromiseRef.current ? await blockPromiseRef.current : pendingBlock
    // Si detectamos la cuadra, usamos el punto proyectado sobre la calle;
    // si no, el punto que marcó el usuario.
    const { lat, lng } = block?.point
      ? { lat: block.point[1], lng: block.point[0] }
      : pendingLocation
    const { data, error } = await supabase
      .from('trapito_spots')
      .insert({
        lat,
        lng,
        // PostGIS espera el punto como WKT vía la columna geom
        geom: toPointWKT(lat, lng),
        // La cuadra (si se detectó) como LINESTRING; null si solo hay punto.
        geom_calle: block?.coords ? toLineWKT(block.coords) : null,
        calle: calle || null,
        descripcion: descripcion || null,
        created_by: session.user.id,
      })
      .select('id')
      .single()

    if (error) {
      setSaving(false)
      setMessage('No se pudo guardar: ' + error.message)
      return
    }

    // Las franjas elegidas quedan como confirmación del creador (no suma reputación).
    if (franjas && franjas.length) {
      await supabase.from('spot_reports').upsert(
        { spot_id: data.id, user_id: session.user.id, tipo: 'confirma', franjas },
        { onConflict: 'spot_id,user_id' }
      )
    }
    setSaving(false)
    setPendingLocation(null)
    setMessage('¡Trapito marcado! Gracias por colaborar 🙌')
    loadSpots(lastViewRef.current)
    loadReputation()
  }

  // --- Votar un trapito (confirmar / "ya no está") ---
  async function handleReport(spotId, tipo, franjasElegidas) {
    if (!session) {
      setMessage('Iniciá sesión para votar.')
      return
    }
    // Al confirmar usamos las franjas elegidas; si no eligió ninguna, la actual.
    const franjas =
      tipo === 'confirma' ? (franjasElegidas?.length ? franjasElegidas : [franjaFromDate()]) : null
    // Un voto por usuario y trapito: si ya votó, se actualiza (upsert)
    const { error } = await supabase.from('spot_reports').upsert(
      { spot_id: spotId, user_id: session.user.id, tipo, franjas },
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

  // --- Reportar un trapito por abuso ---
  async function handleAbuse(spotId, motivo) {
    if (!session) {
      setMessage('Iniciá sesión para reportar.')
      return
    }
    // Un reporte por usuario y trapito (upsert: puede cambiar el motivo)
    const { error } = await supabase.from('abuse_reports').upsert(
      { spot_id: spotId, user_id: session.user.id, motivo },
      { onConflict: 'spot_id,user_id' }
    )
    if (error) {
      setMessage('No se pudo enviar el reporte: ' + error.message)
      return
    }
    setMessage('Gracias, recibimos tu reporte 🙏')
    // Si superó el umbral, el trigger lo ocultó: recargamos para reflejarlo.
    loadSpots(lastViewRef.current)
  }

  return (
    <div className="app">
      <div className="map-wrap">
        <MapView
          userPosition={position}
          spots={spots}
          pendingBlock={pendingBlock}
          onMapClick={(loc) => setPendingLocation(loc)}
          recenterTrigger={recenterTrigger}
          onViewChange={loadSpots}
          canVote={!!session}
          onReport={handleReport}
          onAbuse={handleAbuse}
          onReactivar={handleReactivar}
        />
      </div>

      {/* Barra superior */}
      <header className="topbar">
        <div className="topbar-right">
          {canInstall && (
            <button className="install-btn" onClick={promptInstall} title="Instalar la app">
              📲 Instalar
            </button>
          )}
          <button
            className="icon-btn"
            onClick={toggleVerCaducados}
            title={verCaducados ? 'Ocultar trapitos caducados' : 'Ver trapitos caducados'}
            aria-pressed={verCaducados}
          >
            ♻️
          </button>
          <button
            className="icon-btn"
            onClick={toggleNotificaciones}
            title={
              notifEnabled
                ? 'Notificaciones de proximidad activadas'
                : 'Activar notificaciones de proximidad'
            }
            aria-pressed={notifEnabled}
          >
            {notifEnabled ? '🔔' : '🔕'}
          </button>
          {!session ? (
            <button className="login-btn" onClick={signInAnonymously}>
              Participar
            </button>
          ) : (
            <ReputationBadge stats={reputation} />
          )}
        </div>
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
      </div>

      {/* Ayuda contextual */}
      {!pendingLocation && (
        <div className="hint">Tocá el mapa para marcar un trapito</div>
      )}

      {/* Hoja inferior para cargar */}
      {pendingLocation && (
        <AddSpotForm
          block={pendingBlock}
          blockLoading={blockLoading}
          onRetryBlock={() => detectarCuadra(pendingLocation)}
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
