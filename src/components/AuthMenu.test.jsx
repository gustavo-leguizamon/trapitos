import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AuthMenu from './AuthMenu'

const anonSession = { user: { is_anonymous: true } }
const permanentSession = { user: { is_anonymous: false, email: 'a@b.com' } }

describe('AuthMenu', () => {
  it('sin sesión muestra "Participar" y lo dispara al tocarlo', async () => {
    const onParticipar = vi.fn()
    render(<AuthMenu session={null} onParticipar={onParticipar} />)
    await userEvent.click(screen.getByRole('button', { name: /participar/i }))
    expect(onParticipar).toHaveBeenCalledOnce()
  })

  it('sin sesión permite login por email a quien ya tiene cuenta', async () => {
    const onLoginEmail = vi.fn().mockResolvedValue(true)
    render(<AuthMenu session={null} onLoginEmail={onLoginEmail} />)
    await userEvent.click(screen.getByRole('button', { name: /ya tengo cuenta/i }))
    await userEvent.type(screen.getByPlaceholderText(/email/i), 'a@b.com')
    await userEvent.click(screen.getByRole('button', { name: /enviarme el enlace/i }))
    expect(onLoginEmail).toHaveBeenCalledWith('a@b.com')
  })

  it('sesión anónima ofrece guardar con Google o email', async () => {
    const onLinkGoogle = vi.fn()
    const onSaveEmail = vi.fn().mockResolvedValue(true)
    render(
      <AuthMenu
        session={anonSession}
        reputation={null}
        onLinkGoogle={onLinkGoogle}
        onSaveEmail={onSaveEmail}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await userEvent.click(screen.getByRole('button', { name: /google/i }))
    expect(onLinkGoogle).toHaveBeenCalledOnce()

    await userEvent.type(screen.getByPlaceholderText(/email/i), 'a@b.com')
    await userEvent.click(screen.getByRole('button', { name: /^guardar$/i }))
    expect(onSaveEmail).toHaveBeenCalledWith('a@b.com')
  })

  it('sesión permanente solo muestra la reputación, sin opción de guardar', () => {
    render(<AuthMenu session={permanentSession} reputation={null} />)
    expect(screen.queryByRole('button', { name: /guardar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /participar/i })).not.toBeInTheDocument()
  })
})
