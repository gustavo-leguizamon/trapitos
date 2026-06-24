import { useEffect, useState } from 'react'
import { franjaFromDate } from '../lib/schedule'
import FranjaSelector from './FranjaSelector'

// Formulario para cargar un nuevo trapito en la ubicación seleccionada.
export default function AddSpotForm({
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

  // Cerrar con Escape (salvo mientras se está guardando).
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && !saving) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [saving, onCancel])

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({ calle: calle.trim(), descripcion: descripcion.trim(), franjas })
  }

  const sinCuadra = !blockLoading && !block

  return (
    <>
      {/* Fondo atenuado: enfoca la hoja y permite cerrar tocando fuera. */}
      <div className="sheet-backdrop" onClick={saving ? undefined : onCancel} />

      <div className="sheet" role="dialog" aria-modal="true" aria-label="Marcar un trapito">
        <div className="sheet-grabber" aria-hidden="true" />
        <form onSubmit={handleSubmit}>
          <h2>Marcar un trapito acá</h2>
          <p className="sheet-sub">Contanos dónde lo viste y a qué hora suele estar.</p>

          {/* Dónde se va a marcar */}
          <div className={`where-card${sinCuadra ? ' where-card-warn' : ''}`}>
            <span className="where-status">
              {blockLoading
                ? '🛣️ Detectando la cuadra…'
                : block
                  ? `🛣️ Se pintará la cuadra${block.name ? ` de ${block.name}` : ''}`
                  : '📍 No se detectó la cuadra: se marcará solo el punto.'}
              {sinCuadra && onRetryBlock && (
                <button type="button" className="block-retry" onClick={onRetryBlock}>
                  🔄 Reintentar
                </button>
              )}
            </span>
          </div>

          <label>
            <span className="label-row">
              Calle o esquina <span className="opt">opcional</span>
            </span>
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
            <span className="field-hint">Si la dejás vacía, usamos la calle que detectamos.</span>
          </label>

          <label>
            <span className="label-row">
              Detalle <span className="opt">opcional</span>
            </span>
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
            <button type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar trapito'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
