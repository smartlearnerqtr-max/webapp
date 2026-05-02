import { Suspense, lazy } from 'react'

import type { ActivityCardProps } from './ActivityRenderer'

const ActivityCard = lazy(async () => {
  const module = await import('./ActivityRenderer')
  return { default: module.ActivityCard }
})

type LazyActivityCardProps = ActivityCardProps & {
  loadingLabel?: string
}

export function LazyActivityCard({ loadingLabel = 'Đang tải hoạt động...', ...props }: LazyActivityCardProps) {
  return (
    <Suspense fallback={<p className="helper-text">{loadingLabel}</p>}>
      <ActivityCard {...props} />
    </Suspense>
  )
}
