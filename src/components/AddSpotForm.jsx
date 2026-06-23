import { useState } from 'react'

// Formulario para cargar un nuevo trapito en la ubicación seleccionada.
export default function AddSpotForm({ location, onSubmit, onCancel, saving }) {
  const [calle, setCalle] = useState('')
  const [descripcion, setDescripcion] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({ calle: calle.trim(), descripcion: descripcion.trim() })
  }

  return (
    <div className="sheet">
      <form onSubmit={handleSubmit}>
        <h2>Marcar un trapito acá</h2>
        <p className="coords">
          📍 {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
        </p>

        <label>
          Calle / esquina
          <input
            type="text"
            value={calle}
            onChange={(e) => setCalle(e.target.value)}
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

        <div className="actions">
          <button type="button" className="secondary" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
