import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminLogin from './AdminLogin'

describe('AdminLogin', () => {
  it('no deja entrar sin email y contraseña', () => {
    render(<AdminLogin onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()
  })

  it('manda las credenciales sin espacios al costado del email', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AdminLogin onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('Email'), '  yo@ejemplo.com  ')
    await user.type(screen.getByLabelText('Contraseña'), 'secreta')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(onSubmit).toHaveBeenCalledWith({ email: 'yo@ejemplo.com', password: 'secreta' })
  })

  it('muestra el error del intento anterior', () => {
    render(<AdminLogin onSubmit={vi.fn()} error="No se pudo entrar: credenciales inválidas" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/credenciales inválidas/i)
  })

  it('bloquea el botón mientras verifica', () => {
    render(<AdminLogin onSubmit={vi.fn()} working />)
    expect(screen.getByRole('button', { name: /entrando/i })).toBeDisabled()
  })
})
