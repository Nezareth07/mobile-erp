import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

function TestHarness() {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <button>Outside button</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Test modal">
        <button>First field</button>
        <button>Last field</button>
      </Modal>
    </div>
  )
}

describe('Modal', () => {
  it('focuses the close button on open', () => {
    render(<TestHarness />)

    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
  })

  it('wraps Tab from the last focusable element back to the close button', async () => {
    const user = userEvent.setup()
    render(<TestHarness />)

    const closeButton = screen.getByRole('button', { name: 'Cerrar' })
    const last = screen.getByRole('button', { name: 'Last field' })

    last.focus()
    expect(last).toHaveFocus()

    await user.tab()
    expect(closeButton).toHaveFocus()
  })

  it('wraps Shift+Tab from the close button back to the last focusable element', async () => {
    const user = userEvent.setup()
    render(<TestHarness />)

    const closeButton = screen.getByRole('button', { name: 'Cerrar' })
    const last = screen.getByRole('button', { name: 'Last field' })

    expect(closeButton).toHaveFocus()

    await user.tab({ shift: true })
    expect(last).toHaveFocus()
  })

  it('never lets focus escape to content behind the modal', async () => {
    const user = userEvent.setup()
    render(<TestHarness />)

    const outsideButton = screen.getByRole('button', { name: 'Outside button' })

    // Cycle through every element inside the modal and past the wrap point.
    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab({ shift: true })
    await user.tab({ shift: true })

    expect(outsideButton).not.toHaveFocus()
  })

  it('still moves focus normally between fields inside the modal', async () => {
    const user = userEvent.setup()
    render(<TestHarness />)

    const first = screen.getByRole('button', { name: 'First field' })

    await user.tab()
    expect(first).toHaveFocus()
  })

  it('still closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Test">
        <button>Field</button>
      </Modal>,
    )

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('still closes on backdrop click', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { container } = render(
      <Modal open onClose={onClose} title="Test">
        <button>Field</button>
      </Modal>,
    )

    const backdrop = container.querySelector('[aria-hidden="true"]')
    expect(backdrop).not.toBeNull()
    await user.click(backdrop as Element)

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('exposes the expected dialog aria attributes', () => {
    render(
      <Modal open onClose={() => {}} title="Test dialog">
        <button>Field</button>
      </Modal>,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')
    expect(screen.getByText('Test dialog')).toHaveAttribute('id', 'modal-title')
  })
})
