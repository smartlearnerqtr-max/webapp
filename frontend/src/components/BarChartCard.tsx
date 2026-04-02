import type { CSSProperties } from 'react'

type BarChartItem = {
  label: string
  value: number
  valueLabel?: string
  hint?: string
  color?: string
}

type BarChartCardProps = {
  title?: string
  description?: string
  items: BarChartItem[]
  maxValue?: number
  emptyMessage?: string
  className?: string
}

export function BarChartCard({
  title,
  description,
  items,
  maxValue,
  emptyMessage = 'Chưa có dữ liệu để hiển thị biểu đồ.',
  className,
}: BarChartCardProps) {
  const normalizedItems = items.map((item) => ({
    ...item,
    value: Number.isFinite(item.value) ? Math.max(item.value, 0) : 0,
  }))

  const resolvedMaxValue = Math.max(maxValue ?? 0, ...normalizedItems.map((item) => item.value), 1)

  return (
    <div className={['bar-chart-card', className].filter(Boolean).join(' ')}>
      {title || description ? (
        <div className="bar-chart-head">
          {title ? <h4>{title}</h4> : null}
          {description ? <p>{description}</p> : null}
        </div>
      ) : null}

      {normalizedItems.length ? (
        <div className="bar-chart-columns" role="img" aria-label={title ?? 'Biểu đồ cột'}>
          {normalizedItems.map((item) => {
            const columnHeight = Math.max((item.value / resolvedMaxValue) * 100, item.value > 0 ? 12 : 0)
            const style = {
              '--bar-chart-color': item.color ?? 'linear-gradient(180deg, #4a7ae2 0%, #335dc4 100%)',
              height: `${columnHeight}%`,
            } as CSSProperties

            return (
              <div key={`${item.label}-${item.valueLabel ?? item.value}`} className="bar-chart-column">
                <strong className="bar-chart-value">{item.valueLabel ?? item.value}</strong>
                <div className="bar-chart-track">
                  <div className="bar-chart-fill" style={style} />
                </div>
                <div className="bar-chart-meta">
                  <span className="bar-chart-label">{item.label}</span>
                  {item.hint ? <span className="bar-chart-hint">{item.hint}</span> : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="helper-text">{emptyMessage}</p>
      )}
    </div>
  )
}
