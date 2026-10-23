import type { FinanceRow } from '@shared/types/models'
import { formatCents } from '@shared/money'

interface BarChartProps {
  rows: FinanceRow[]
}

const WIDTH = 900
const HEIGHT = 280
const PADDING = { top: 18, right: 20, bottom: 38, left: 64 }

function compactMoney(cents: number): string {
  const yuan = cents / 100
  if (Math.abs(yuan) >= 10000) return `${(yuan / 10000).toFixed(1)}万`
  if (Math.abs(yuan) >= 1000) return `${(yuan / 1000).toFixed(1)}千`
  return String(Math.round(yuan))
}

export function BarChart({ rows }: BarChartProps): React.JSX.Element {
  if (rows.length === 0) {
    return <div className="chart-empty">这个时间段还没有处方</div>
  }

  const innerWidth = WIDTH - PADDING.left - PADDING.right
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom
  const values = rows.flatMap((row) => [row.revenueCents, row.costCents, row.profitCents, 0])
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = Math.max(max - min, 1)
  const yOf = (value: number): number => PADDING.top + ((max - value) / span) * innerHeight
  const baseline = yOf(0)
  const groupWidth = innerWidth / rows.length
  const barWidth = Math.min(14, Math.max(5, groupWidth * 0.16))
  const gap = Math.max(2, barWidth * 0.3)

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const value = max - span * ratio
    return { value, y: PADDING.top + innerHeight * ratio }
  })

  return (
    <div>
      <div className="chart-head">
        <div className="chart-legend">
          <span>
            <i className="legend-dot" style={{ background: 'var(--primary)' }} /> 收入
          </span>
          <span>
            <i className="legend-dot" style={{ background: 'var(--text-tertiary)' }} /> 成本
          </span>
          <span>
            <i className="legend-dot" style={{ background: 'var(--success)' }} /> 盈利
          </span>
        </div>
      </div>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="收入、成本、盈利分组柱状图"
      >
        {gridLines.map((line, index) => (
          <g key={index}>
            <line
              x1={PADDING.left}
              x2={WIDTH - PADDING.right}
              y1={line.y}
              y2={line.y}
              stroke="var(--divider)"
              strokeWidth={1}
            />
            <text x={PADDING.left - 10} y={line.y + 4} textAnchor="end" fill="var(--text-tertiary)" fontSize={11}>
              {compactMoney(line.value)}
            </text>
          </g>
        ))}

        {rows.map((row, index) => {
          const groupX = PADDING.left + index * groupWidth
          const center = groupX + groupWidth / 2
          const revenueX = center - barWidth - gap
          const costX = center - barWidth / 2
          const profitX = center + gap
          const revenueY = yOf(row.revenueCents)
          const costY = yOf(row.costCents)
          const profitBase = row.profitCents >= 0 ? yOf(row.profitCents) : baseline
          const profitY = row.profitCents >= 0 ? profitBase : yOf(row.profitCents)
          const profitHeight = Math.abs(baseline - profitY)
          const profitColor = row.profitCents >= 0 ? 'var(--success)' : 'var(--danger)'
          return (
            <g key={row.key}>
              <rect
                x={revenueX}
                y={revenueY}
                width={barWidth}
                height={Math.max(1, baseline - revenueY)}
                rx={2}
                fill="var(--primary)"
              >
                <title>{`${row.label} 收入 ${formatCents(row.revenueCents)}`}</title>
              </rect>
              <rect
                x={costX}
                y={costY}
                width={barWidth}
                height={Math.max(1, baseline - costY)}
                rx={2}
                fill="var(--text-tertiary)"
              >
                <title>{`${row.label} 成本 ${formatCents(row.costCents)}`}</title>
              </rect>
              <rect
                x={profitX}
                y={profitY}
                width={barWidth}
                height={Math.max(1, profitHeight)}
                rx={2}
                fill={profitColor}
              >
                <title>{`${row.label} 盈利 ${formatCents(row.profitCents)}`}</title>
              </rect>
              <text
                x={center}
                y={HEIGHT - PADDING.bottom + 18}
                textAnchor="middle"
                fill="var(--text-tertiary)"
                fontSize={11}
              >
                {row.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
