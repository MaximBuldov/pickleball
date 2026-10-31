import { ReloadOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 70
const MAX_PULL = 110

/** Touches inside these never start a pull (they scroll or drag on their own). */
const IGNORE = '.ant-modal-wrap, .ant-select-dropdown, .ant-picker-dropdown, .ant-popover, .ant-table-content'

/**
 * Pull down at the top of the page to refresh. Standalone PWAs on iOS have no
 * browser reload, so this is the only way to refresh without the header button.
 */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const pullRef = useRef(0)

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const target = e.target as Element
      startY.current = window.scrollY <= 0 && !refreshing && !target.closest(IGNORE) ? e.touches[0].clientY : null
    }
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return
      const dy = e.touches[0].clientY - startY.current
      if (dy <= 0 || window.scrollY > 0) {
        pullRef.current = 0
        setPull(0)
        return
      }
      // Resistance: the further you pull, the slower the indicator follows.
      pullRef.current = Math.min(MAX_PULL, dy * 0.5)
      setPull(pullRef.current)
    }
    const onEnd = async () => {
      if (startY.current === null) return
      startY.current = null
      const reached = pullRef.current >= THRESHOLD * 0.8
      pullRef.current = 0
      setPull(0)
      if (!reached) return
      setRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
      }
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
  }, [onRefresh, refreshing])

  const height = refreshing ? 48 : pull
  if (height === 0) return null
  const progress = Math.min(1, pull / (THRESHOLD * 0.8))

  return (
    <div className="ptr" style={{ height }}>
      <ReloadOutlined
        spin={refreshing}
        style={{ fontSize: 20, opacity: refreshing ? 1 : progress, transform: refreshing ? undefined : `rotate(${progress * 270}deg)` }}
      />
    </div>
  )
}
