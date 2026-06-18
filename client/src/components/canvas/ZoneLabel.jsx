import { useState, useRef } from 'react'
import clsx from 'clsx'
import { useStore } from '../../store/useStore.js'
import ContextMenu, { useContextMenu } from '../ui/ContextMenu.jsx'
import styles from './ZoneLabel.module.css'

export default function ZoneLabel({ zoneId, screenToCanvas }) {
  const zone = useStore((s) => s.zones[zoneId])
  const isSelected = useStore((s) => s.selection.type === 'zone' && s.selection.id === zoneId)
  const gridSnap = useStore((s) => s.settings.gridSnap)
  const gridSize = useStore((s) => s.settings.gridSize || 20)
  const select = useStore((s) => s.select)
  const dispatch = useStore((s) => s.dispatch)
  const patchEntityLive = useStore((s) => s.patchEntityLive)
  const renameZone = useStore((s) => s.renameZone)
  const removeZone = useStore((s) => s.removeZone)

  const { menu, openAt, close } = useContextMenu()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)
  const movedRef = useRef(false)

  if (!zone) return null

  const onPointerDown = (e) => {
    if (e.button !== 0 || editing) return
    e.stopPropagation()
    const start = screenToCanvas(e.clientX, e.clientY)
    const orig = useStore.getState().zones[zoneId]
    movedRef.current = false
    const onMove = (ev) => {
      const p = screenToCanvas(ev.clientX, ev.clientY)
      if (!movedRef.current && Math.abs(p.x - start.x) + Math.abs(p.y - start.y) > 2) {
        movedRef.current = true
      }
      let nx = orig.x + (p.x - start.x)
      let ny = orig.y + (p.y - start.y)
      if (gridSnap) {
        nx = Math.round(nx / gridSize) * gridSize
        ny = Math.round(ny / gridSize) * gridSize
      }
      patchEntityLive('zones', zoneId, { x: Math.round(nx), y: Math.round(ny) })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (movedRef.current) {
        const fz = useStore.getState().zones[zoneId]
        dispatch({
          type: 'MOVE_ZONE',
          label: 'Move zone',
          payload: { zones: { [zoneId]: fz } },
          inverse: { zones: { [zoneId]: orig } },
        })
      } else {
        select('zone', zoneId)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startResize = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const orig = useStore.getState().zones[zoneId]
    const onMove = (ev) => {
      const p = screenToCanvas(ev.clientX, ev.clientY)
      patchEntityLive('zones', zoneId, {
        width: Math.max(40, Math.round(p.x - orig.x)),
        height: Math.max(40, Math.round(p.y - orig.y)),
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const fz = useStore.getState().zones[zoneId]
      dispatch({
        type: 'RESIZE_ZONE',
        label: 'Resize zone',
        payload: { zones: { [zoneId]: fz } },
        inverse: { zones: { [zoneId]: orig } },
      })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const startRename = () => {
    setDraft(zone.label)
    setEditing(true)
    requestAnimationFrame(() => inputRef.current?.select())
  }
  const commitRename = () => {
    const v = draft.trim()
    if (v) renameZone(zoneId, v)
    setEditing(false)
  }

  const toggleShape = () => {
    const next = zone.shape === 'circle' ? 'rect' : 'circle'
    dispatch({
      type: 'ZONE_SHAPE',
      label: 'Change zone shape',
      payload: { zones: { [zoneId]: { ...zone, shape: next } } },
      inverse: { zones: { [zoneId]: zone } },
    })
  }

  const menuItems = [
    { label: 'Rename', icon: 'edit', onClick: startRename },
    {
      label: zone.shape === 'circle' ? 'Make rectangle' : 'Make circle',
      icon: 'square',
      onClick: toggleShape,
    },
    { separator: true },
    { label: 'Delete zone', icon: 'trash', danger: true, onClick: () => removeZone(zoneId) },
  ]

  return (
    <div
      className={clsx(styles.zone, isSelected && styles.selected)}
      style={{ left: zone.x, top: zone.y, width: zone.width, height: zone.height }}
      data-canvas-item
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation()
        startRename()
      }}
      onContextMenu={openAt}
    >
      <div
        className={styles.fill}
        style={{
          background: zone.colour,
          borderRadius: zone.shape === 'circle' ? '50%' : 'var(--radius-md)',
        }}
      />
      {editing ? (
        <input
          ref={inputRef}
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
      ) : (
        <span className={styles.label}>{zone.label}</span>
      )}
      <button
        type="button"
        className={styles.handle}
        aria-label="Resize zone"
        onPointerDown={startResize}
      />
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={close} />}
    </div>
  )
}
