import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddSpotForm from './AddSpotForm'

const location = { lat: -34.71, lng: -58.25 }

describe('AddSpotForm', () => {
  it('muestra las coordenadas de la ubicación elegida', () => {
    render(<AddSpotForm location={location} onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(/-34.71000, -58.25000/)).toBeInTheDocument()
  })

  it('envía calle y descripción (sin espacios sobrantes) al guardar', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<AddSpotForm location={location} onSubmit={onSubmit} onCancel={vi.fn()} />)

    await user.type(screen.getByPlaceholderText(/Av. Corrientes/), '  Mitre y San Martín  ')
    await user.type(screen.getByPlaceholderText(/turno tarde/), ' frente al banco ')
    await user.click(screen.getByRole('button', { name: /guardar/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      calle: 'Mitre y San Martín',
      descripcion: 'frente al banco',
    })
  })

  it('llama a onCancel al cancelar', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<AddSpotForm location={location} onSubmit={vi.fn()} onCancel={onCancel} />)

    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('deshabilita los botones mientras guarda', () => {
    render(<AddSpotForm location={location} onSubmit={vi.fn()} onCancel={vi.fn()} saving />)
    expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled()
  })
})
