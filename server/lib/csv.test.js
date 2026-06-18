import { describe, it, expect } from 'vitest'
import { parseCsv, toCsv } from './csv.js'

describe('parseCsv', () => {
  it('parses headers into keyed row objects', () => {
    const { headers, rows } = parseCsv('First,Last\nEmma,Clarke\nJohn,Doe\n')
    expect(headers).toEqual(['First', 'Last'])
    expect(rows).toEqual([
      { First: 'Emma', Last: 'Clarke' },
      { First: 'John', Last: 'Doe' },
    ])
  })

  it('handles quoted fields with commas, escaped quotes, and newlines', () => {
    const text = 'name,note\n"Smith, Jane","said ""hi"""\n"multi\nline",ok\n'
    const { rows } = parseCsv(text)
    expect(rows[0]).toEqual({ name: 'Smith, Jane', note: 'said "hi"' })
    expect(rows[1].name).toBe('multi\nline')
  })

  it('strips a BOM, accepts CRLF, and skips blank lines', () => {
    const { headers, rows } = parseCsv('﻿a,b\r\n1,2\r\n\r\n3,4\r\n')
    expect(headers).toEqual(['a', 'b'])
    expect(rows).toHaveLength(2)
  })

  it('returns empty structures for empty input', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] })
  })
})

describe('toCsv', () => {
  it('quotes only the fields that need it', () => {
    const csv = toCsv(['a', 'b'], [['plain', 'has, comma']])
    expect(csv).toContain('plain,"has, comma"')
  })

  it('doubles embedded quotes and quotes newlines', () => {
    const csv = toCsv(['a'], [['say "hi"'], ['line\nbreak']])
    expect(csv).toContain('"say ""hi"""')
    expect(csv).toContain('"line\nbreak"')
  })
})
