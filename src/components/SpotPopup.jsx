import { useState } from 'react'
import { confidenceLevel, levelLabel } from '../lib/confidence'
import { freshnessText, isAboutToExpire } from '../lib/expiry'
import { rankedFranjas, franjaFromDate, franjaLabel, FRANJAS } from '../lib/schedule'

// Contenido del popup de un trapito: datos, votos de la comunidad y acciones.
export default function SpotPopup({ spot, canVote, onReport }) {
  const confirma = spot.confirma_count ?? 0
  const desmiente = spot.desmiente_count ?? 0
  const level = confidenceLevel(confirma, desmiente)
  const seen = freshnessText(spot.last_activity)
  const expiring = isAboutToExpire(spot.last_activity)
  const franjas = rankedFranjas(spot.horarios)

  // Al confirmar, el usuario elige la franja; la hora actual viene sugerida.
  const [picking, setPicking] = useState(false)
  const ahora = franjaFromDate()

  function confirmar(franja) {
    onReport(spot.id, 'confirma', franja)
    setPicking(false)
  }

  return (
    <div className="spot-popup">
      <strong>{spot.calle || 'Trapito'}</strong>
      {spot.descripcion && <p className="desc">{spot.descripcion}</p>}

      <p className={`level level-${level}`}>{levelLabel(level)}</p>

      {seen && (
        <p className="freshness">
          👁 {seen}
          {expiring && <span className="expiring"> · ⏳ por caducar</span>}
        </p>
      )}

      {franjas.length > 0 && (
        <p className="horarios">
          🕒 Suele estar: {franjas.map((f) => `${f.label} (${f.cantidad})`).join(' · ')}
        </p>
      )}

      <div className="votes">
        <span title="Confirmaciones">👍 {confirma}</span>
        <span title="Reportes de 'ya no está'">👎 {desmiente}</span>
      </div>

      {!canVote ? (
        <p className="vote-hint">Tocá "Participar" para votar</p>
      ) : picking ? (
        <div className="franja-picker">
          <p className="franja-q">¿En qué horario lo viste?</p>
          <div className="franja-options">
            {FRANJAS.map((f) => (
              <button
                key={f}
                className={f === ahora ? 'franja now' : 'franja'}
                onClick={() => confirmar(f)}
              >
                {franjaLabel(f)}
                {f === ahora ? ' · ahora' : ''}
              </button>
            ))}
          </div>
          <button className="franja-cancel" onClick={() => setPicking(false)}>
            Cancelar
          </button>
        </div>
      ) : (
        <div className="vote-actions">
          <button className="confirm" onClick={() => setPicking(true)}>
            Confirmo
          </button>
          <button className="deny" onClick={() => onReport(spot.id, 'desmiente')}>
            Ya no está
          </button>
        </div>
      )}
    </div>
  )
}
