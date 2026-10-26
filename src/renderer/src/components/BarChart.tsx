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
  const max = Math.max(...rows.map((row) => row.revenueCents), 1)
  const yOf = (value: number): number => PADDING.top + ((max - value) / max) * innerHeight
  const baseline = yOf(0)
  const groupWidth = innerWidth / rows.length
  const barWidth = Math.min(42, Math.max(12, groupWidth * 0.48))

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: max - max * ratio,
    y: PADDING.top + innerHeight * ratio
  }))

  return (
    <div>
      <div className="chart-head">
        <div className="chart-legend">
          <span>
            <i className="legend-dot" style={{ background: 'var(--primary)' }} /> 处方费用营业额
          </span>
        </div>
      </div>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="处方费用营业额柱状图"
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
            <text
              x={PADDING.left - 10}
              y={line.y + 4}
              textAnchor="end"
              fill="var(--text-tertiary)"
              fontSize={11}
            >
              {compactMoney(line.value)}
            </text>
          </g>
        ))}

        {rows.map((row, index) => {
          const groupX = PADDING.left + index * groupWidth
          const center = groupX + groupWidth / 2
          const revenueY = yOf(row.revenueCents)
          return (
            <g key={row.key}>
              <rect
                x={center - barWidth / 2}
                y={revenueY}
                width={barWidth}
                height={Math.max(1, baseline - revenueY)}
                rx={3}
                fill="var(--primary)"
              >
                <title>{`${row.label} 营业额 ${formatCents(row.revenueCents)}`}</title>
              </rect>
              <text
                x={center}
                y={revenueY - 6}
                textAnchor="middle"
                fill="var(--text-secondary)"
                fontSize={10}
              >
                {formatCents(row.revenueCents)}
              </text>
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
