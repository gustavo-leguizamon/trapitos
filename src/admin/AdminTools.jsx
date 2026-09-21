import { useState } from 'react'

// Tareas de mantenimiento a pedido. Presentacional: la red vive en AdminApp.
// Las tres corren igual solas o desde acá; el panel sirve para no esperar al
// cron cuando querés ver el efecto ahora.
export default function AdminTools({
  onExpirar,
  onRevisar,
  onContarAnonimos,
  onLimpiarAnonimos,
  working,
  anonimosBorrables,
}) {
  const [dias, setDias] = useState(30)
  const [confirmar, setConfirmar] = useState(false)

  return (
    <section className="admin-tools">
      <h2>Mantenimiento</h2>

      <div className="admin-tool">
        <div>
          <strong>Caducar marcas viejas o desmentidas</strong>
          <p>
            Lo mismo que corre a diario: pasa a <em>caducado</em> lo que junta desmentidos o lleva
            90 días sin actividad.
          </p>
        </div>
        <button disabled={!!working} onClick={onExpirar}>
          {working === 'expirar' ? 'Corriendo…' : 'Correr ahora'}
        </button>
      </div>

      <div className="admin-tool">
        <div>
          <strong>Revisar reportes de abuso</strong>
          <p>
            Repasa las marcas cuyos reportantes ya cumplieron 24 h de antigüedad y oculta las que
            llegaron al umbral.
          </p>
        </div>
        <button disabled={!!working} onClick={onRevisar}>
          {working === 'revisar' ? 'Corriendo…' : 'Correr ahora'}
        </button>
      </div>

      <div className="admin-tool">
        <div>
          <strong>Limpiar cuentas anónimas</strong>
          <p>
            Borra las cuentas anónimas de más de{' '}
            <input
              className="admin-dias"
              type="number"
              min="1"
              max="3650"
              value={dias}
              aria-label="Días de antigüedad"
              onChange={(e) => {
                setDias(e.target.value)
                setConfirmar(false)
              }}
            />{' '}
            días que <strong>no dejaron nada</strong>. Las que cargaron o votaron algo se quedan
            (borrarlas se llevaría sus datos por cascada).
          </p>
          {anonimosBorrables !== null && (
            <p className="admin-tool-hint">
              Se borrarían <strong>{anonimosBorrables}</strong> cuentas.
            </p>
          )}
        </div>
        <div className="admin-tool-actions">
          <button disabled={!!working} onClick={() => onContarAnonimos(Number(dias))}>
            {working === 'contar' ? 'Contando…' : 'Contar'}
          </button>
          {confirmar ? (
            <>
              <button
                className="danger"
                disabled={!!working}
                onClick={() => {
                  setConfirmar(false)
                  onLimpiarAnonimos(Number(dias))
                }}
              >
                {working === 'limpiar' ? 'Borrando…' : 'Borrar de verdad'}
              </button>
              <button disabled={!!working} onClick={() => setConfirmar(false)}>
                No
              </button>
            </>
          ) : (
            <button className="danger-outline" disabled={!!working} onClick={() => setConfirmar(true)}>
              Borrar
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
