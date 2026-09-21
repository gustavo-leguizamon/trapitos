import { useState } from 'react'
import {
  accionesDeEstado,
  autorText,
  motivosText,
  osmLink,
  statusEmoji,
  statusLabel,
} from '../lib/admin'
import { freshnessText } from '../lib/expiry'

// Tabla de marcas del panel. Presentacional: recibe las filas ya normalizadas
// y avisa por callbacks. Toda la red vive en AdminApp.
export default function SpotsTable({ spots, onSetStatus, onEditar, onBorrar, busyId, loading }) {
  // Fila en edición y su borrador; fila con el borrado pendiente de confirmar.
  const [editando, setEditando] = useState(null)
  const [borrador, setBorrador] = useState({ calle: '', descripcion: '' })
  const [confirmarBorrado, setConfirmarBorrado] = useState(null)

  function empezarEdicion(spot) {
    setConfirmarBorrado(null)
    setEditando(spot.id)
    setBorrador({ calle: spot.calle ?? '', descripcion: spot.descripcion ?? '' })
  }

  function guardarEdicion(spot) {
    onEditar(spot.id, borrador)
    setEditando(null)
  }

  if (!loading && !spots.length) {
    return <p className="admin-empty">No hay marcas que coincidan con el filtro.</p>
  }

  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>Estado</th>
          <th>Lugar</th>
          <th>Votos</th>
          <th>Reportes</th>
          <th>Autor</th>
          <th>Actividad</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        {spots.map((spot) => {
          const enEdicion = editando === spot.id
          const ocupada = busyId === spot.id
          const motivos = motivosText(spot.motivos)
          const mapa = osmLink(spot.lat, spot.lng)
          return (
            <tr key={spot.id} className={ocupada ? 'is-busy' : undefined}>
              <td>
                <span className={`admin-status admin-status-${spot.status}`}>
                  {statusEmoji(spot.status)} {statusLabel(spot.status)}
                </span>
              </td>

              <td className="admin-lugar">
                {enEdicion ? (
                  <div className="admin-edit">
                    <label htmlFor={`calle-${spot.id}`}>Calle</label>
                    <input
                      id={`calle-${spot.id}`}
                      value={borrador.calle}
                      onChange={(e) => setBorrador({ ...borrador, calle: e.target.value })}
                    />
                    <label htmlFor={`desc-${spot.id}`}>Detalle</label>
                    <input
                      id={`desc-${spot.id}`}
                      value={borrador.descripcion}
                      onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })}
                    />
                    <div className="admin-edit-actions">
                      <button className="primary" onClick={() => guardarEdicion(spot)}>
                        Guardar
                      </button>
                      <button onClick={() => setEditando(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <strong>{spot.calle || 'sin calle'}</strong>
                    {spot.descripcion && <div className="admin-desc">{spot.descripcion}</div>}
                    {mapa && (
                      <a className="admin-osm" href={mapa} target="_blank" rel="noreferrer">
                        ver en el mapa ↗
                      </a>
                    )}
                  </>
                )}
              </td>

              <td className="admin-num">
                👍 {spot.confirma} · 👎 {spot.desmiente}
              </td>

              <td className={spot.abuse ? 'admin-reportes admin-reportes-hay' : 'admin-reportes'}>
                {motivos ? `⚠️ ${motivos}` : '—'}
              </td>

              <td className="admin-autor">{autorText(spot)}</td>

              <td className="admin-actividad">{freshnessText(spot.lastActivity) || '—'}</td>

              <td className="admin-acciones">
                {accionesDeEstado(spot.status).map((accion) => (
                  <button
                    key={accion.status}
                    disabled={ocupada}
                    onClick={() => onSetStatus(spot.id, accion.status)}
                  >
                    {accion.label}
                  </button>
                ))}
                {!enEdicion && (
                  <button disabled={ocupada} onClick={() => empezarEdicion(spot)}>
                    Editar
                  </button>
                )}
                {confirmarBorrado === spot.id ? (
                  <>
                    <button
                      className="danger"
                      disabled={ocupada}
                      onClick={() => {
                        setConfirmarBorrado(null)
                        onBorrar(spot.id)
                      }}
                    >
                      Borrar de verdad
                    </button>
                    <button disabled={ocupada} onClick={() => setConfirmarBorrado(null)}>
                      No
                    </button>
                  </>
                ) : (
                  <button
                    className="danger-outline"
                    disabled={ocupada}
                    onClick={() => setConfirmarBorrado(spot.id)}
                  >
                    Borrar
                  </button>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
