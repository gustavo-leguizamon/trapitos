import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useEffect } from 'react'

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

// Captura el toque/click en el mapa para sugerir una nueva marca
function ClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
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

export default function MapView({ userPosition, spots, onMapClick, recenterTrigger, onViewChange }) {
  const center = userPosition || { lat: -34.6037, lng: -58.3816 } // CABA por defecto

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

      <ClickHandler onMapClick={onMapClick} />
      <Recenter center={userPosition} trigger={recenterTrigger} />
      <ViewportLoader onViewChange={onViewChange} />

      {userPosition && (
        <Marker position={[userPosition.lat, userPosition.lng]} icon={userIcon}>
          <Popup>Estás acá</Popup>
        </Marker>
      )}

      {spots.map((spot) => (
        <Marker key={spot.id} position={[spot.lat, spot.lng]} icon={defaultIcon}>
          <Popup>
            <strong>{spot.calle || 'Trapito'}</strong>
            {spot.descripcion && <p style={{ margin: '4px 0 0' }}>{spot.descripcion}</p>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
