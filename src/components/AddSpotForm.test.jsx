import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddSpotForm from './AddSpotForm'

// Fijamos la franja "actual" para que la preselección sea determinista.
vi.mock('../lib/schedule', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, franjaFromDate: () => 'tarde' }
})

describe('AddSpotForm', () => {
  it('no muestra coordenadas crudas al usuario', () => {
    render(<AddSpotForm onSubmit={vi.fn()} onCancel={vi.fn()} />)
    // Las lat/lng no le aportan nada al usuario: no deben aparecer en pantalla.
    expect(screen.queryByText(/-?\d+\.\d{4,}/)).not.toBeInTheDocument()
  })

  it('envía calle, descripción (sin espacios) y las franjas al guardar', async () => {
    // delay: null => tipeo instantáneo, evita timeouts por lentitud bajo carga.
    const user = userEvent.setup({ delay: null })
    const onSubmit = vi.fn()
    render(<AddSpotForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await user.type(screen.getByPlaceholderText(/Av. Corrientes/), '  Mitre y San Martín  ')
    await user.type(screen.getByPlaceholderText(/turno tarde/), ' frente al banco ')
    // Sumamos una franja a la sugerida por defecto
    await user.click(screen.getByRole('button', { name: /madrugada/i }))
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const arg = onSubmit.mock.calls[0][0]
    expect(arg.calle).toBe('Mitre y San Martín')
    expect(arg.descripcion).toBe('frente al banco')
    expect(Array.isArray(arg.franjas)).toBe(true)
    expect(arg.franjas).toContain('madrugada')
  })

  it('llama a onCancel al cancelar', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<AddSpotForm onSubmit={vi.fn()} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('deshabilita los botones mientras guarda', () => {
    render(<AddSpotForm onSubmit={vi.fn()} onCancel={vi.fn()} saving />)
    expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled()
  })
})
