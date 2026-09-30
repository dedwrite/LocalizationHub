import { useEffect, useState } from 'react'

/** Same platform rule as the palette, with deterministic prerender markup. */
export default function ShortcutKey() {
  const [mac, setMac] = useState(false)
  useEffect(() => { setMac(/Mac|iPhone|iPad/u.test(navigator.platform)) }, [])
  return <kbd dir="ltr">{mac ? '⌘ K' : 'Ctrl K'}</kbd>
}
