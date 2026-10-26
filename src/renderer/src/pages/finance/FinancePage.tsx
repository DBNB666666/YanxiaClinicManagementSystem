import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { FinanceDetails, FinancePeriod, FinanceRow } from '@shared/types/models'
import {
  formatPeriodLabel,
  getPeriodRange,
  shiftPeriod,
  todayIso
} from '@shared/date'
import { formatCents } from '@shared/money'
import { BarChart } from '../../components/BarChart'
import {
  Button,
  Drawer,
  EmptyState,
  PageHeader,
  StatCard
} from '../../components/Ui'
import { useAsync } from '../../hooks/useAsync'

const PERIODS: { value: FinancePeriod; label: string }[] = [
  { value: 'day', label: '日账本' },
  { value: 'week', label: '周账本' },
  { value: 'month', label: '月账本' },
  { value: 'year', label: '年账本' }
]

function resetLabel(period: FinancePeriod): string {
  if (period === 'day') return '回到今天'
  if (period === 'week') return '回到本周'
  if (period === 'month') return '回到本月'
  return '回到今年'
}

export function FinancePage(): React.JSX.Element {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<FinancePeriod>('day')
  const [anchorDate, setAnchorDate] = useState(todayIso())
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<FinanceDetails | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const { data, loading, error } = useAsync(
    () => window.api.finance.summary({ period, anchorDate }),
    [period, anchorDate]
  )

  const summary = data?.summary
  const rows = data?.rows ?? []
  const range = useMemo(() => getPeriodRange(period, anchorDate), [period, anchorDate])

  const openDetails = async (row: FinanceRow): Promise<void> => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const result = await window.api.finance.details({
        period,
        anchorDate,
        key: row.key,
        label: row.label
      })
      setDetail(result)
    } catch {
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div data-testid="finance-page">
      <PageHeader title="财务" subtitle="统计口径：处方开具日期" />

      <div className="finance-tabs">
        <div className="segmented" role="tablist" aria-label="账本周期">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={period === item.value}
              className={`seg-btn ${period === item.value ? 'active' : ''}`.trim()}
              data-testid={`finance-tab-${item.value}`}
              onClick={() => setPeriod(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="finance-nav">
          <Button
            variant="secondary"
            size="sm"
            aria-label="上一周期"
            onClick={() => setAnchorDate(shiftPeriod(period, anchorDate, -1))}
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="period-label" data-testid="finance-period-label">
            {formatPeriodLabel(period, anchorDate)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            aria-label="下一周期"
            onClick={() => setAnchorDate(shiftPeriod(period, anchorDate, 1))}
          >
            <ChevronRight size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnchorDate(todayIso())}>
            {resetLabel(period)}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="muted">正在统计…</div>
      ) : error ? (
        <div className="inline-error">{error.message}</div>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard testId="finance-revenue" label="处方费用营业额" value={formatCents(summary?.revenueCents ?? 0)} />
            <StatCard testId="finance-count" label="处方数" value={`${summary?.count ?? 0} 张`} />
          </div>

          {period !== 'day' ? (
            <div className="chart-wrap" data-testid="finance-chart">
              <BarChart rows={rows} />
            </div>
          ) : null}

          <div className="finance-detail-table">
            {rows.length === 0 ? (
              <EmptyState
                title="这个时间段还没有处方"
                description={`${range.from} 至 ${range.to}`}
                action={
                  <Button variant="primary" onClick={() => navigate('/prescriptions/new')}>
                    去开处方
                  </Button>
                }
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{period === 'day' ? '患者' : '期间'}</th>
                      <th className="num">处方数</th>
                      <th className="num">处方费用营业额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.key}
                        style={{ cursor: 'pointer' }}
                        data-testid={`finance-row-${row.key}`}
                        onClick={() => void openDetails(row)}
                      >
                        <td>{row.label}</td>
                        <td className="num">{row.count}</td>
                        <td className="num">{formatCents(row.revenueCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <Drawer
        open={detailOpen}
        title={detail?.label ?? '期间明细'}
        onClose={() => setDetailOpen(false)}
        wide
        testId="finance-detail-drawer"
      >
        {detailLoading ? (
          <div className="muted">正在加载明细…</div>
        ) : !detail || detail.items.length === 0 ? (
          <EmptyState title="没有处方明细" />
        ) : (
          <div>
            <div className="muted" style={{ marginBottom: 8 }}>
              共 {detail.items.length} 张处方
            </div>
            {detail.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="notification-item"
                onClick={() => navigate(`/prescriptions/${item.id}/edit`)}
              >
                <span className="notification-body">
                  <span className="notification-name">
                    {item.patientName} · {item.gender} · {item.age}
                  </span>
                  <span className="notification-meta">
                    {item.issueDate} · 处方费用 {formatCents(item.feeCents)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  )
}
