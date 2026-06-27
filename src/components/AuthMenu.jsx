import { useState } from 'react'
import ReputationBadge from './ReputationBadge'

// Menú de identidad en el header. Cubre tres estados:
//  - Sin sesión: botón "Participar" (alta anónima) + "ya tengo cuenta" (magic link).
//  - Sesión anónima: badge de reputación + "Guardar cuenta" (Google o email).
//  - Sesión permanente: solo el badge.
// Las acciones de auth viven en App.jsx (donde está supabase) y llegan por props.
export default function AuthMenu({
  session,
  reputation,
  onParticipar,
  onLinkGoogle,
  onSaveEmail,
  onLoginEmail,
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const temporary = !!session?.user?.is_anonymous
  const permanent = !!session && !temporary

  // Sesión permanente: nada que vincular, solo la reputación.
  if (permanent) return <ReputationBadge stats={reputation} />

  // Envía el email al handler correspondiente (guardar cuenta o login) y,
  // si sale bien, cierra el panel.
  async function submitEmail(handler) {
    if (!email.trim() || busy) return
    setBusy(true)
    const ok = await handler(email.trim())
    setBusy(false)
    if (ok) {
      setEmail('')
      setOpen(false)
    }
  }

  return (
    <div className="auth-menu">
      {temporary ? (
        <>
          <ReputationBadge stats={reputation} />
          <button
            className="save-account-btn"
            onClick={() => setOpen((o) => !o)}
            title="Guardá tu cuenta para no perder tu reputación"
            aria-expanded={open}
          >
            💾 Guardar
          </button>
        </>
      ) : (
        <button className="login-btn" onClick={onParticipar}>
          Participar
        </button>
      )}

      {open && (
        <div className="auth-panel" role="dialog">
          {temporary ? (
            <>
              <p className="auth-panel-title">
                Guardá tu cuenta para no perder tu reputación al cambiar de
                dispositivo.
              </p>
              <button className="google-btn" onClick={onLinkGoogle} disabled={busy}>
                Continuar con Google
              </button>
              <div className="auth-sep">o con tu email</div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  submitEmail(onSaveEmail)
                }}
              >
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button type="submit" disabled={busy}>
                  {busy ? 'Enviando…' : 'Guardar'}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="auth-panel-title">¿Ya participaste antes?</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  submitEmail(onLoginEmail)
                }}
              >
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button type="submit" disabled={busy}>
                  {busy ? 'Enviando…' : 'Enviarme el enlace'}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* En la pantalla sin sesión, el acceso para quien ya tiene cuenta. */}
      {!session && (
        <button className="have-account-link" onClick={() => setOpen((o) => !o)}>
          Ya tengo cuenta
        </button>
      )}
    </div>
  )
}
