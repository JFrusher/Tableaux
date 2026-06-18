import { useEffect } from 'react'
import { useStore } from '../store/useStore.js'
import { saveNow } from './useAutoSave.js'
import { fitCanvasToContent, zoomCanvasBy } from '../utils/canvasCoords.js'

const isEditable = (el) =>
  !!el &&
  (el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable)

/** Global keyboard shortcuts (see the README table). Mounted once at the root. */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e) => {
      const s = useStore.getState()
      const mod = e.metaKey || e.ctrlKey
      const key = e.key

      // Save works even while typing.
      if (mod && key.toLowerCase() === 's') {
        e.preventDefault()
        saveNow({ manual: true })
        return
      }

      // Don't hijack keys while typing in a field.
      if (isEditable(document.activeElement)) return

      if (mod && key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
        return
      }
      if (mod && key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
        return
      }
      if (mod && key.toLowerCase() === 'a') {
        e.preventDefault()
        s.setSelectedGuestIds(
          Object.values(s.guests)
            .filter((g) => !g.assignedTableId)
            .map((g) => g.id)
        )
        return
      }
      if (mod && key.toLowerCase() === 'd') {
        if (s.selection.type === 'table' && s.tables[s.selection.id]) {
          e.preventDefault()
          s.duplicateTable(s.selection.id)
        }
        return
      }
      if (mod) return // leave other browser shortcuts alone

      switch (key) {
        case 'Escape':
          if (s.modal) s.closeModal()
          else if (s.activeTool !== 'select') s.setActiveTool('select')
          else s.clearSelection()
          break
        case 'Delete':
        case 'Backspace':
          if (s.selection.type === 'table' && s.tables[s.selection.id]) {
            e.preventDefault()
            const t = s.tables[s.selection.id]
            s.openModal('confirm', {
              title: 'Delete table?',
              message: `"${t.label}" will be removed and its guests returned to the waiting list.`,
              confirmLabel: 'Delete',
              danger: true,
              onConfirm: () => {
                s.removeTable(t.id)
                s.clearSelection()
              },
            })
          }
          break
        case 'f':
        case 'F':
          fitCanvasToContent()
          break
        case '+':
        case '=':
          zoomCanvasBy(1.2)
          break
        case '-':
        case '_':
          zoomCanvasBy(1 / 1.2)
          break
        case 'g':
        case 'G':
          if (s.selectedGuestIds.length > 0) {
            s.createGroup(s.selectedGuestIds)
            s.clearSelection()
          }
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
