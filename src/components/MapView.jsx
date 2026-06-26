import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useRef } from 'react'
import SpotPopup from './SpotPopup'
import { confidenceLevel, levelOpacity, levelColor } from '../lib/confidence'

// Arregla los íconos por defecto de Leaflet (que se rompen con bundlers como Vite)
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'

const defaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
})

// Ícono distinto (azul) para "vos estás acá"
const userIcon = L.divIcon({
  className: 'user-location-dot',
  html: '<div class="pulse"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

// Color gris para las cuadras de trapitos caducados.
const CADUCADO_COLOR = '#9e9e9e'

// Convierte coords GeoJSON [[lng,lat], ...] al orden [[lat,lng], ...] de Leaflet.
function toLatLngs(coords) {
  return coords.map(([lng, lat]) => [lat, lng])
}

// Envuelve el contenido del popup. Marca una bandera de tiempo cuando el usuario
// interactúa con el popup, para que el handler de click del mapa pueda ignorar
// ese click (que si no abriría el formulario de alta).
function PopupContent({ children, interactionRef }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const mark = () => {
      interactionRef.current = Date.now()
    }
    // Capturamos pointerdown/mousedown/touchstart (ocurren ANTES del click del mapa).
    el.addEventListener('pointerdown', mark, true)
    el.addEventListener('mousedown', mark, true)
    el.addEventListener('touchstart', mark, true)
    el.addEventListener('click', mark, true)
    L.DomEvent.disableScrollPropagation(el)
    return () => {
      el.removeEventListener('pointerdown', mark, true)
      el.removeEventListener('mousedown', mark, true)
      el.removeEventListener('touchstart', mark, true)
      el.removeEventListener('click', mark, true)
    }
  }, [interactionRef])
  return <div ref={ref}>{children}</div>
}

// Captura el toque/click en el mapa para sugerir una nueva marca.
// Ignora el click si se originó dentro de un popup (botones "Confirmo", franjas, etc.).
function ClickHandler({ onMapClick, interactionRef }) {
  useMapEvents({
    click(e) {
      // 1) Si hubo interacción con un popup hace muy poco, este click viene de ahí.
      if (Date.now() - (interactionRef.current || 0) < 700) return
      // 2) Respaldo: si el target está dentro de un popup, ignorarlo.
      const target = e.originalEvent?.target
      if (target?.closest?.('.leaflet-popup')) return
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

// Calcula el área visible del mapa (centro + radio en metros).
function viewFromMap(map) {
  const center = map.getCenter()
  const radius = map.distance(center, map.getBounds().getNorthEast())
  return { lat: center.lat, lng: center.lng, radius }
}

// Recentra el mapa en la ubicación del usuario al tocar el botón 🎯 y, además,
// automáticamente la primera vez que se obtiene la ubicación.
function Recenter({ center, trigger, onViewChange }) {
  const map = useMap()
  const didInitialCenter = useRef(false)

  function recenter() {
    // animate:false → el reposicionamiento es síncrono, así getBounds() ya
    // refleja la nueva área al recargar los trapitos.
    map.setView([center.lat, center.lng], map.getZoom(), { animate: false })
    // Recargamos explícitamente: no dependemos del evento moveend, que durante
    // el re-render puede dispararse mientras ViewportLoader tiene su handler
    // momentáneamente desconectado (y así perderse).
    onViewChange(viewFromMap(map))
  }

  // Centrado automático apenas llega la ubicación (una sola vez).
  useEffect(() => {
    if (center && !didInitialCenter.current) {
      didInitialCenter.current = true
      recenter()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center])

  // Centrado manual: cada vez que el usuario toca el botón 🎯.
  useEffect(() => {
    if (trigger > 0 && center) recenter()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])

  return null
}

// Carga los trapitos que están dentro del área visible del mapa.
// Se dispara al iniciar y cada vez que el usuario mueve/zoomea el mapa.
function ViewportLoader({ onViewChange }) {
  const map = useMap()

  function fire() {
    onViewChange(viewFromMap(map))
  }

  useMapEvents({
    moveend() {
      fire()
    },
    zoomend() {
      fire()
    },
  })

  useEffect(() => {
    fire() // carga inicial
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default function MapView({
  userPosition,
  spots,
  pendingBlock,
  onMapClick,
  recenterTrigger,
  onViewChange,
  canVote,
  onReport,
  onAbuse,
  onReactivar,
}) {
  const center = userPosition || { lat: -34.6037, lng: -58.3816 } // CABA por defecto
  // Momento de la última interacción con un popup (para no abrir el alta por error).
  const popupInteractRef = useRef(0)

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={16}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickHandler onMapClick={onMapClick} interactionRef={popupInteractRef} />
      <Recenter center={userPosition} trigger={recenterTrigger} onViewChange={onViewChange} />
      <ViewportLoader onViewChange={onViewChange} />

      {userPosition && (
        <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon}>
          <Popup>Estás acá</Popup>
        </Marker>
      )}

      {/* Vista previa de la cuadra detectada al marcar un trapito nuevo */}
      {pendingBlock?.coords?.length >= 2 && (
        <Polyline
          positions={toLatLngs(pendingBlock.coords)}
          pathOptions={{ color: '#1565c0', weight: 7, opacity: 0.7, dashArray: '6 8' }}
        />
      )}

      {spots.map((spot) => {
        const level = confidenceLevel(spot.confirma_count, spot.desmiente_count)
        const caducado = spot.status === 'inactivo'
        const linea = spot.calle_geom?.coordinates
        const popup = (
          <Popup closeOnClick={false}>
            <PopupContent interactionRef={popupInteractRef}>
              <SpotPopup
                spot={spot}
                canVote={canVote}
                onReport={onReport}
                onAbuse={onAbuse}
                onReactivar={onReactivar}
              />
            </PopupContent>
          </Popup>
        )

        // Con cuadra: pintamos la calle coloreada según la confianza.
        if (linea?.length >= 2) {
          return (
            <Polyline
              key={spot.id}
              positions={toLatLngs(linea)}
              pathOptions={{
                color: caducado ? CADUCADO_COLOR : levelColor(level),
                weight: 7,
                opacity: caducado ? 0.45 : 0.85,
              }}
            >
              {popup}
            </Polyline>
          )
        }

        // Respaldo: marcas viejas sin cuadra, siguen como pin.
        const opacity = caducado ? 0.35 : levelOpacity(level)
        return (
          <Marker key={spot.id} position={[spot.lat, spot.lng]} icon={defaultIcon} opacity={opacity}>
            {/* closeOnClick=false: que no se cierre al elegir franjas/confirmar.
                Se cierra con la X o al abrir otro trapito (autoClose por defecto). */}
            {popup}
          </Marker>
        )
      })}
    </MapContainer>
  )
}
