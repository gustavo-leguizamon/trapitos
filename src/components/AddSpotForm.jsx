import { useEffect, useState } from 'react'
import { franjaFromDate } from '../lib/schedule'
import FranjaSelector from './FranjaSelector'

// Formulario para cargar un nuevo trapito en la ubicación seleccionada.
export default function AddSpotForm({
  location,
  block,
  blockLoading,
  onRetryBlock,
  onSubmit,
  onCancel,
  saving,
}) {
  const [calle, setCalle] = useState('')
  const [calleTocada, setCalleTocada] = useState(false)
  const [descripcion, setDescripcion] = useState('')
  // Por defecto sugerimos la franja actual; el usuario puede elegir varias.
  const [franjas, setFranjas] = useState([franjaFromDate()])

  // Cuando OSM detecta el nombre de la calle, lo sugerimos (si el usuario no escribió).
  useEffect(() => {
    if (block?.name && !calleTocada) setCalle(block.name)
  }, [block, calleTocada])

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({ calle: calle.trim(), descripcion: descripcion.trim(), franjas })
  }

  return (
    <div className="sheet">
      <form onSubmit={handleSubmit}>
        <h2>Marcar un trapito acá</h2>
        <p className="coords">
          📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
        </p>

        <p className={`block-status${!blockLoading && !block ? ' block-status-warn' : ''}`}>
          {blockLoading ? (
            '🛣️ Detectando la cuadra…'
          ) : block ? (
            `🛣️ Se pintará la cuadra${block.name ? ` de ${block.name}` : ''}`
          ) : (
            <>
              📍 No se detectó la cuadra: se marcará solo el punto.
              {onRetryBlock && (
                <button type="button" className="block-retry" onClick={onRetryBlock}>
                  🔄 Reintentar
                </button>
              )}
            </>
          )}
        </p>

        <label>
          Calle / esquina
          <input
            type="text"
            value={calle}
            onChange={(e) => {
              setCalleTocada(true)
              setCalle(e.target.value)
            }}
            placeholder="Ej: Av. Corrientes y Callao"
            autoFocus
          />
        </label>

        <label>
          Detalle (opcional)
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: turno tarde, suele estar frente al super"
            rows={2}
          />
        </label>

        <span className="field-label">¿En qué horario(s) suele estar?</span>
        <FranjaSelector value={franjas} onChange={setFranjas} />

        <div className="actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" disabled={saving || blockLoading}>
            {saving ? 'Guardando…' : blockLoading ? 'Detectando cuadra…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
