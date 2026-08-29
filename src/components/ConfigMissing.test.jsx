import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ConfigMissing from './ConfigMissing'

describe('ConfigMissing', () => {
  it('lista las variables que faltan', () => {
    const { container } = render(
      <ConfigMissing missing={['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']} />
    )
    expect(container.querySelector('pre').textContent).toBe(
      'VITE_SUPABASE_URL\nVITE_SUPABASE_ANON_KEY'
    )
  })

  it('muestra solo la variable faltante cuando falta una sola', () => {
    const { container } = render(<ConfigMissing missing={['VITE_SUPABASE_ANON_KEY']} />)
    expect(container.querySelector('pre').textContent).toBe('VITE_SUPABASE_ANON_KEY')
  })

  it('explica cómo arreglarlo y avisa del punto en .env', () => {
    render(<ConfigMissing missing={['VITE_SUPABASE_URL']} />)
    expect(screen.getByRole('heading')).toHaveTextContent(/falta configurar/i)
    expect(screen.getByText(/Vite no lo lee/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /recargar/i })).toBeInTheDocument()
  })

  it('no rompe si no recibe props', () => {
    const { container } = render(<ConfigMissing />)
    expect(container.querySelector('pre').textContent).toBe('')
  })
})
