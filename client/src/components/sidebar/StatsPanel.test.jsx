import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatsPanel from './StatsPanel.jsx'
import { useStore } from '../../store/useStore.js'

beforeEach(() => {
  useStore.getState().hydrate({
    guests: {
      g1: { id: 'g1', fullName: 'Ada Lovelace', assignedTableId: 't1', dietary: 'vegan', rsvpStatus: 'confirmed' },
      g2: { id: 'g2', fullName: 'Alan Turing', assignedTableId: null, dietary: '', rsvpStatus: 'confirmed' },
    },
    tables: {
      t1: { id: 't1', label: 'Table 1', capacity: 8, assignedGuestIds: ['g1'], seatMode: 'table' },
    },
  })
})

describe('StatsPanel', () => {
  it('renders the overview with live counts driven by the store', () => {
    render(<StatsPanel />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Guests')).toBeInTheDocument()
    expect(screen.getByText('Seated')).toBeInTheDocument()
    expect(screen.getByText('Unseated')).toBeInTheDocument()
  })

  it('shows the dietary breakdown and the table-fill list', () => {
    render(<StatsPanel />)
    expect(screen.getByText('Vegan')).toBeInTheDocument()
    expect(screen.getByText('Table 1')).toBeInTheDocument()
    expect(screen.getByText('1/8')).toBeInTheDocument()
  })

  it('prompts to import when there are no guests', () => {
    useStore.getState().hydrate({ guests: {}, tables: {} })
    render(<StatsPanel />)
    expect(screen.getByText(/import your guest list/i)).toBeInTheDocument()
  })
})
