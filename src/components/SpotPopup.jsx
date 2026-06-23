import { confidenceLevel, levelLabel } from '../lib/confidence'
import { freshnessText, isAboutToExpire } from '../lib/expiry'

// Contenido del popup de un trapito: datos, votos de la comunidad y acciones.
export default function SpotPopup({ spot, canVote, onReport }) {
  const confirma = spot.confirma_count ?? 0
  const desmiente = spot.desmiente_count ?? 0
  const level = confidenceLevel(confirma, desmiente)
  const seen = freshnessText(spot.last_activity)
  const expiring = isAboutToExpire(spot.last_activity)

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

      <div className="votes">
        <span title="Confirmaciones">👍 {confirma}</span>
        <span title="Reportes de 'ya no está'">👎 {desmiente}</span>
      </div>

      {canVote ? (
        <div className="vote-actions">
          <button className="confirm" onClick={() => onReport(spot.id, 'confirma')}>
            Confirmo
          </button>
          <button className="deny" onClick={() => onReport(spot.id, 'desmiente')}>
            Ya no está
          </button>
        </div>
      ) : (
        <p className="vote-hint">Tocá "Participar" para votar</p>
      )}
    </div>
  )
}
