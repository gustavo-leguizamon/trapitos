import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminTools from './AdminTools'

function setup(props = {}) {
  const handlers = {
    onExpirar: vi.fn(),
    onRevisar: vi.fn(),
    onContarAnonimos: vi.fn(),
    onLimpiarAnonimos: vi.fn(),
    anonimosBorrables: null,
  }
  render(<AdminTools {...handlers} {...props} />)
  return handlers
}

describe('AdminTools', () => {
  it('dispara las tareas de mantenimiento', async () => {
    const user = userEvent.setup()
    const { onExpirar, onRevisar } = setup()
    const [expirar, revisar] = screen.getAllByRole('button', { name: 'Correr ahora' })

    await user.click(expirar)
    expect(onExpirar).toHaveBeenCalled()

    await user.click(revisar)
    expect(onRevisar).toHaveBeenCalled()
  })

  it('cuenta las cuentas anónimas con los días elegidos', async () => {
    const user = userEvent.setup()
    const { onContarAnonimos } = setup()

    const dias = screen.getByLabelText(/días de antigüedad/i)
    await user.clear(dias)
    await user.type(dias, '90')
    await user.click(screen.getByRole('button', { name: 'Contar' }))

    expect(onContarAnonimos).toHaveBeenCalledWith(90)
  })

  it('muestra cuántas cuentas se borrarían antes de borrarlas', () => {
    setup({ anonimosBorrables: 12 })
    expect(screen.getByText(/se borrarían/i)).toHaveTextContent('12')
  })

  it('la limpieza pide confirmación', async () => {
    const user = userEvent.setup()
    const { onLimpiarAnonimos } = setup()

    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(onLimpiarAnonimos).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /borrar de verdad/i }))
    expect(onLimpiarAnonimos).toHaveBeenCalledWith(30)
  })

  it('cambiar los días cancela una confirmación pendiente', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    await user.type(screen.getByLabelText(/días de antigüedad/i), '0')

    expect(screen.queryByRole('button', { name: /borrar de verdad/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument()
  })

  it('bloquea todo mientras una tarea corre', () => {
    setup({ working: 'expirar' })
    expect(screen.getByRole('button', { name: 'Corriendo…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Contar' })).toBeDisabled()
  })
})
