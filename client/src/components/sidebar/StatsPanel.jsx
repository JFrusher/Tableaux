import { useMemo } from 'react'
import { useStore } from '../../store/useStore.js'
import { DIETARY_META, dietaryLabel } from '../../utils/dietary.js'
import { fillColour } from '../../utils/seatPositions.js'
import styles from './StatsPanel.module.css'

export default function StatsPanel() {
  const guests = useStore((s) => s.guests)
  const tables = useStore((s) => s.tables)
  const select = useStore((s) => s.select)

  const stats = useMemo(() => {
    const list = Object.values(guests)
    const total = list.length
    const seated = list.filter((g) => g.assignedTableId).length
    const diet = {}
    list.forEach((g) => {
      if (g.dietary) diet[g.dietary] = (diet[g.dietary] || 0) + 1
    })
    const dietEntries = Object.entries(diet).sort((a, b) => b[1] - a[1])
    const tableList = Object.values(tables).sort((a, b) =>
      String(a.label).localeCompare(String(b.label), undefined, { numeric: true })
    )
    return {
      total,
      seated,
      unassigned: total - seated,
      dietEntries,
      maxDiet: Math.max(1, ...dietEntries.map((e) => e[1])),
      tableList,
    }
  }, [guests, tables])

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <h2 className={styles.title}>Overview</h2>
      </header>

      <div className={styles.numbers}>
        <div className={styles.stat}>
          <span className={styles.value}>{stats.total}</span>
          <span className={styles.statLabel}>Guests</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.value}>{stats.seated}</span>
          <span className={styles.statLabel}>Seated</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.value}>{stats.unassigned}</span>
          <span className={styles.statLabel}>Unseated</span>
        </div>
      </div>

      {stats.dietEntries.length > 0 && (
        <section className={styles.section}>
          <p className={styles.sectionLabel}>Dietary</p>
          <div className={styles.bars}>
            {stats.dietEntries.map(([key, count]) => (
              <div key={key} className={styles.barRow}>
                <span className={styles.barName}>
                  <span
                    className={styles.dot}
                    style={{ background: DIETARY_META[key]?.colour || 'var(--ink-muted)' }}
                  />
                  {dietaryLabel(key)}
                </span>
                <span className={styles.track}>
                  <span
                    className={styles.fill}
                    style={{
                      width: `${(count / stats.maxDiet) * 100}%`,
                      background: DIETARY_META[key]?.colour || 'var(--ink-muted)',
                    }}
                  />
                </span>
                <span className={styles.barCount}>{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {stats.tableList.length > 0 && (
        <section className={styles.section}>
          <p className={styles.sectionLabel}>Table fill</p>
          <div className={styles.tables}>
            {stats.tableList.map((t) => {
              const seated = (t.assignedGuestIds || []).filter(Boolean).length
              const ratio = t.capacity ? seated / t.capacity : 0
              return (
                <button
                  key={t.id}
                  type="button"
                  className={styles.tableRow}
                  onClick={() => select('table', t.id)}
                >
                  <span className={styles.tableName}>{t.label}</span>
                  <span className={styles.track}>
                    <span
                      className={styles.fill}
                      style={{
                        width: `${Math.min(ratio, 1) * 100}%`,
                        background: fillColour(ratio),
                      }}
                    />
                  </span>
                  <span className={styles.tableCount}>
                    {seated}/{t.capacity}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {stats.total === 0 && (
        <p className={styles.empty}>Import your guest list to see live counts here.</p>
      )}
    </div>
  )
}
