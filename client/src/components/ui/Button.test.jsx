import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Button from './Button.jsx'

describe('Button', () => {
  it('renders its label as an accessible button', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('fires onClick when pressed', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Import</Button>)
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when the disabled prop is set', () => {
    render(
      <Button disabled onClick={() => {}}>
        Export
      </Button>
    )
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled()
  })

  it('defaults to type="button" so it never submits a form', () => {
    render(<Button>Click</Button>)
    expect(screen.getByRole('button', { name: 'Click' })).toHaveAttribute('type', 'button')
  })
})
