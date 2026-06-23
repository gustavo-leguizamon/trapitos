import { reputationScore, reputationLevel, reputationLabel } from '../lib/reputation'

// Badge con la reputación del usuario logueado. `stats` son los agregados
// que devuelve la función mi_reputacion (o null mientras carga).
export default function ReputationBadge({ stats }) {
  const score = reputationScore(stats || {})
  const level = reputationLevel(score)

  const titulo = stats
    ? `${stats.spotsCreados ?? 0} marcas · ${stats.confirmacionesRecibidas ?? 0} confirmaciones · ` +
      `${stats.desmentidosRecibidos ?? 0} desmentidos · ${stats.votosEmitidos ?? 0} votos`
    : 'Tu reputación'

  return (
    <span className={`reputation reputation-${level}`} title={titulo}>
      {reputationLabel(level)} · {score}
    </span>
  )
}
