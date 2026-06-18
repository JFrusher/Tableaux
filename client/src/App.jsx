import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from '@dnd-kit/core'
import { useAutoSave } from './hooks/useAutoSave.js'
import { useCanvasDnd } from './hooks/useCanvasDnd.js'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js'
import { WarningsProvider } from './store/warningsContext.jsx'
import AppShell from './components/layout/AppShell.jsx'
import ModalRoot from './components/layout/ModalRoot.jsx'
import ToastViewport from './components/ui/Toast.jsx'
import DragPreview from './components/canvas/DragPreview.jsx'

export default function App() {
  useAutoSave()
  useKeyboardShortcuts()

  // Touch uses a press-and-hold to start a drag so a quick swipe still scrolls
  // the guest list / pans the canvas. Mouse keeps the small distance threshold.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const { activeDrag, onDragStart, onDragEnd, onDragCancel } = useCanvasDnd()

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <WarningsProvider>
        <AppShell />
        <DragOverlay dropAnimation={null} zIndex={9999}>
          <DragPreview drag={activeDrag} />
        </DragOverlay>
        <ModalRoot />
        <ToastViewport />
      </WarningsProvider>
    </DndContext>
  )
}
