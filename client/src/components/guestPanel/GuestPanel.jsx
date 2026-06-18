import { useMemo, useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore.js'
import Icon from '../ui/Icon.jsx'
import IconButton from '../ui/IconButton.jsx'
import Button from '../ui/Button.jsx'
import GuestCard from './GuestCard.jsx'
import GroupBlock from './GroupBlock.jsx'
import GuestSearch from './GuestSearch.jsx'
import ContextMenu from '../ui/ContextMenu.jsx'
import { matchesSearch, matchesFilters } from '../../utils/guestFilters.js'
import styles from './GuestPanel.module.css'

function WeddingName() {
  const name = useStore((s) => s.meta.weddingName)
  const updateMeta = useStore((s) => s.updateMeta)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = () => {
    const v = draft.trim()
    if (v) updateMeta({ weddingName: v })
    else setDraft(name)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={styles.nameInput}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            setDraft(name)
            setEditing(false)
          }
        }}
      />
    )
  }
  return (
    <button
      type="button"
      className={styles.name}
      onClick={() => {
        setDraft(name)
        setEditing(true)
      }}
      title="Rename wedding"
    >
      {name}
    </button>
  )
}

export default function GuestPanel() {
  const guests = useStore((s) => s.guests)
  const groups = useStore((s) => s.groups)
  const search = useStore((s) => s.search)
  const filters = useStore((s) => s.filters)
  const selection = useStore((s) => s.selection)
  const selectedGuestIds = useStore((s) => s.selectedGuestIds)
  const select = useStore((s) => s.select)
  const createGroup = useStore((s) => s.createGroup)
  const createEmptyGroup = useStore((s) => s.createEmptyGroup)
  const clearSelection = useStore((s) => s.clearSelection)
  const removeFromGroup = useStore((s) => s.removeFromGroup)
  const unassignGuest = useStore((s) => s.unassignGuest)
  const removeGuest = useStore((s) => s.removeGuest)
  const removeGuests = useStore((s) => s.removeGuests)
  const openModal = useStore((s) => s.openModal)
  const addGuest = useStore((s) => s.addGuest)
  const togglePanel = useStore((s) => s.togglePanel)

  const [cardMenu, setCardMenu] = useState(null) // { x, y, guestId }

  // Create a blank guest and open it in the inspector for editing.
  const handleAddGuest = () => {
    const cmd = addGuest()
    if (cmd?.meta?.newGuestId) {
      select('guest', cmd.meta.newGuestId)
      if (!useStore.getState().panels.right) togglePanel('right')
    }
  }

  // Create an empty group; it appears in the list (and the inspector dropdown)
  // ready to receive guests.
  const handleNewGroup = () => createEmptyGroup()

  const { visibleGroups, ungrouped, total, unassigned } = useMemo(() => {
    const list = Object.values(guests)
    const groupArr = Object.values(groups).sort((a, b) =>
      String(a.name).localeCompare(String(b.name))
    )

    const vGroups = groupArr
      .map((group) => {
        const members = (group.memberIds || [])
          .map((id) => guests[id])
          .filter(Boolean)
          .filter((g) => matchesSearch(g, group, search) && matchesFilters(g, filters))
        return { group, members }
      })
      // Show groups with matching members; also show genuinely empty groups when
      // not searching, so a freshly-created "New group" is visible to fill.
      .filter(
        (vg) => vg.members.length > 0 || (!search && (vg.group.memberIds || []).length === 0)
      )

    const ung = list
      .filter((g) => !g.groupId || !groups[g.groupId])
      .filter((g) => matchesSearch(g, null, search) && matchesFilters(g, filters))
      .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)))

    return {
      visibleGroups: vGroups,
      ungrouped: ung,
      total: list.length,
      unassigned: list.filter((g) => !g.assignedTableId).length,
    }
  }, [guests, groups, search, filters])

  const selectedGuestId = selection.type === 'guest' ? selection.id : null
  const selectedSet = useMemo(() => new Set(selectedGuestIds), [selectedGuestIds])

  const onCardContextMenu = (guestId, e) => {
    e.preventDefault()
    e.stopPropagation()
    setCardMenu({ x: e.clientX, y: e.clientY, guestId })
  }

  const cardMenuItems = useMemo(() => {
    if (!cardMenu) return []
    const g = guests[cardMenu.guestId]
    if (!g) return []
    const multi = selectedGuestIds.length > 1 && selectedGuestIds.includes(g.id)
    return [
      { label: 'Edit details', icon: 'user', onClick: () => select('guest', g.id) },
      multi && {
        label: `Group ${selectedGuestIds.length} selected`,
        icon: 'users',
        onClick: () => {
          createGroup(selectedGuestIds)
          clearSelection()
        },
      },
      g.groupId && {
        label: 'Remove from group',
        icon: 'x',
        onClick: () => removeFromGroup(g.id),
      },
      g.assignedTableId && {
        label: 'Unassign from table',
        icon: 'x',
        onClick: () => unassignGuest(g.id),
      },
      { separator: true },
      multi
        ? {
            label: `Delete ${selectedGuestIds.length} selected`,
            icon: 'trash',
            danger: true,
            onClick: () => {
              removeGuests(selectedGuestIds)
              clearSelection()
            },
          }
        : {
            label: 'Delete guest',
            icon: 'trash',
            danger: true,
            onClick: () => removeGuest(g.id),
          },
    ].filter(Boolean)
  }, [
    cardMenu,
    guests,
    selectedGuestIds,
    select,
    createGroup,
    clearSelection,
    removeFromGroup,
    unassignGuest,
    removeGuest,
    removeGuests,
  ])

  const hasGuests = total > 0
  const noResults = hasGuests && visibleGroups.length === 0 && ungrouped.length === 0

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <WeddingName />
          <div className={styles.headerActions}>
            <IconButton icon="plus" label="Add guest" onDark onClick={handleAddGuest} />
            <IconButton
              icon="upload"
              label="Import guests"
              onDark
              onClick={() => openModal('import')}
            />
          </div>
        </div>
        <p className={styles.stats}>
          {total} {total === 1 ? 'guest' : 'guests'}
          {hasGuests && <span className={styles.dot}> · </span>}
          {hasGuests && <span>{unassigned} unassigned</span>}
        </p>
      </header>

      {hasGuests && <GuestSearch />}

      <div className={styles.scroll}>
        {!hasGuests && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <Icon name="users" size={28} />
            </div>
            <p className={styles.emptyTitle}>Start by importing your guest list</p>
            <Button variant="primary" icon="upload" onClick={() => openModal('import')}>
              Import CSV
            </Button>
            <p className={styles.emptyNote}>
              Have a Joy, Zola, or spreadsheet export? We&rsquo;ll help you map the columns.
            </p>
          </div>
        )}

        {noResults && (
          <p className={styles.noResults}>No guests match your search or filters.</p>
        )}

        {hasGuests && (
          <div className={styles.groupsBar}>
            <span className={styles.sectionLabel}>Groups</span>
            <button type="button" className={styles.newGroupBtn} onClick={handleNewGroup}>
              <Icon name="plus" size={12} /> New group
            </button>
          </div>
        )}

        {visibleGroups.length > 0 && (
          <section className={styles.section}>
            {visibleGroups.map(({ group, members }) => (
              <GroupBlock
                key={group.id}
                group={group}
                members={members}
                selectedGuestId={selectedGuestId}
                selectedSet={selectedSet}
                onCardContextMenu={onCardContextMenu}
              />
            ))}
          </section>
        )}

        {ungrouped.length > 0 && (
          <section className={styles.section}>
            {visibleGroups.length > 0 && <p className={styles.sectionLabel}>Other guests</p>}
            <div className={styles.flatList}>
              {ungrouped.map((g) => (
                <GuestCard
                  key={g.id}
                  guest={g}
                  selected={selectedGuestId === g.id}
                  multiSelected={selectedSet.has(g.id)}
                  onContextMenu={(e) => onCardContextMenu(g.id, e)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {cardMenu && (
        <ContextMenu
          x={cardMenu.x}
          y={cardMenu.y}
          items={cardMenuItems}
          onClose={() => setCardMenu(null)}
        />
      )}
    </div>
  )
}
