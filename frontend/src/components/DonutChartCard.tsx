import type { CSSProperties } from 'react'

type DonutChartItem = {
  label: string
  value: number
  color?: string
  hint?: string
}

type DonutChartCardProps = {
  title?: string
  description?: string
  items: DonutChartItem[]
  totalLabel?: string
  emptyMessage?: string
  className?: string
}

function toGradient(items: Array<DonutChartItem & { value: number }>) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  if (!total) {
    return 'conic-gradient(from 180deg, rgba(214, 226, 245, 0.9) 0deg 360deg)'
  }

  let currentAngle = 0
  const segments: string[] = []

  items.forEach((item) => {
    if (!item.value) return
    const angle = (item.value / total) * 360
    const nextAngle = currentAngle + angle
    segments.push(`${item.color ?? '#4a7ae2'} ${currentAngle}deg ${nextAngle}deg`)
    currentAngle = nextAngle
  })

  return `conic-gradient(from 180deg, ${segments.join(', ')})`
}

export function DonutChartCard({
  title,
  description,
  items,
  totalLabel = 'Tổng học sinh',
  emptyMessage = 'Chưa có dữ liệu để hiển thị biểu đồ.',
  className,
}: DonutChartCardProps) {
  const normalizedItems = items.map((item) => ({
    ...item,
    value: Number.isFinite(item.value) ? Math.max(item.value, 0) : 0,
  }))
  const total = normalizedItems.reduce((sum, item) => sum + item.value, 0)
  const chartStyle = {
    '--donut-chart-gradient': toGradient(normalizedItems),
  } as CSSProperties

  return (
    <div className={['donut-chart-card', className].filter(Boolean).join(' ')}>
      {title || description ? (
        <div className="donut-chart-head">
          {title ? <h4>{title}</h4> : null}
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}

      {normalizedItems.length && total ? (
        <div className="donut-chart-layout">
          <div className="donut-chart-visual" role="img" aria-label={title ?? 'Biểu đồ tròn'}>
            <div className="donut-chart-ring" style={chartStyle}>
              <div className="donut-chart-center">
                <strong>{total}</strong>
                <span>{totalLabel}</span>
              </div>
            </div>
          </div>

          <div className="donut-chart-legend">
            {normalizedItems.map((item) => {
              const percentage = total ? Math.round((item.value / total) * 100) : 0

              return (
                <div key={`${item.label}-${item.value}`} className="donut-chart-legend-item">
                  <span className="donut-chart-swatch" style={{ background: item.color ?? '#4a7ae2' }} />
                  <div className="donut-chart-legend-copy">
                    <strong>{item.label}</strong>
                    <span>{item.value} học sinh ? {percentage}%</span>
                    {item.hint ? <small>{item.hint}</small> : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="helper-text">{emptyMessage}</p>
      )}
    </div>
  )
}
