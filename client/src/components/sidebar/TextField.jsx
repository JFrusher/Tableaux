import { useState, useEffect, useRef } from 'react'

/**
 * Controlled text input/textarea that commits on blur or Enter and stays in
 * sync with external changes (e.g. undo) while not focused. Avoids spamming
 * the store on every keystroke.
 */
export default function TextField({ value, onCommit, as = 'input', ...rest }) {
  const [draft, setDraft] = useState(value ?? '')
  const focused = useRef(false)

  useEffect(() => {
    if (!focused.current) setDraft(value ?? '')
  }, [value])

  const commit = () => {
    focused.current = false
    if (draft !== (value ?? '')) onCommit(draft)
  }

  const Tag = as
  return (
    <Tag
      value={draft}
      onFocus={() => {
        focused.current = true
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && as !== 'textarea') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraft(value ?? '')
          focused.current = false
          e.currentTarget.blur()
        }
      }}
      {...rest}
    />
  )
}
