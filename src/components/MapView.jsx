import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useRef } from 'react'
import SpotPopup from './SpotPopup'
import { confidenceLevel, levelOpacity } from '../lib/confidence'

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

// Recentra el mapa cuando cambia la ubicación del usuario (solo la primera vez)
function Recenter({ center, trigger }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView([center.lat, center.lng], map.getZoom())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger])
  return null
}

// Carga los trapitos que están dentro del área visible del mapa.
// Se dispara al iniciar y cada vez que el usuario mueve/zoomea el mapa.
function ViewportLoader({ onViewChange }) {
  const map = useMap()

  function fire() {
    const center = map.getCenter()
    const radius = map.distance(center, map.getBounds().getNorthEast())
    onViewChange({ lat: center.lat, lng: center.lng, radius })
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
      <Recenter center={userPosition} trigger={recenterTrigger} />
      <ViewportLoader onViewChange={onViewChange} />

      {userPosition && (
        <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon}>
          <Popup>Estás acá</Popup>
        </Marker>
      )}

      {spots.map((spot) => {
        const level = confidenceLevel(spot.confirma_count, spot.desmiente_count)
        // Los caducados (inactivo) se ven más atenuados que los activos.
        const opacity = spot.status === 'inactivo' ? 0.35 : levelOpacity(level)
        return (
          <Marker
            key={spot.id}
            position={[spot.lat, spot.lng]}
            icon={defaultIcon}
            opacity={opacity}
          >
            {/* closeOnClick=false: que no se cierre al elegir franjas/confirmar.
                Se cierra con la X o al abrir otro trapito (autoClose por defecto). */}
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
          </Marker>
        )
      })}
    </MapContainer>
  )
}
