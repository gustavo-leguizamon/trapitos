import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FranjaSelector from './FranjaSelector'

describe('FranjaSelector', () => {
  it('agrega una franja al tocarla', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<FranjaSelector value={[]} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /tarde/i }))
    expect(onChange).toHaveBeenCalledWith(['tarde'])
  })

  it('quita una franja ya seleccionada', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<FranjaSelector value={['tarde', 'noche']} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /tarde/i }))
    expect(onChange).toHaveBeenCalledWith(['noche'])
  })

  it('marca como presionadas las franjas seleccionadas', () => {
    render(<FranjaSelector value={['noche']} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /noche/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /mañana/i })).toHaveAttribute('aria-pressed', 'false')
  })
})
