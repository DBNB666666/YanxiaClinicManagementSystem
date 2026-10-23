import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Plus, Trash2 } from 'lucide-react'
import type { PrescriptionSummary } from '@shared/types/models'
import { getPeriodRange, todayIso } from '@shared/date'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  ViewToggle
} from '../../components/Ui'
import { useAsync } from '../../hooks/useAsync'
import { useSettings } from '../../context/SettingsProvider'
import { useToast } from '../../context/ToastProvider'

type DateFilter = 'all' | 'today' | 'week' | 'month'

function dateRange(filter: DateFilter): { dateFrom?: string; dateTo?: string } {
  if (filter === 'all') return {}
  const today = todayIso()
  const range = getPeriodRange(filter === 'today' ? 'day' : filter, today)
  return { dateFrom: range.from, dateTo: range.to }
}

export function PrescriptionListPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { settings, setViewMode } = useSettings()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState<PrescriptionSummary | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const pageSize = 20
  const viewMode = settings.viewModes.prescriptions
  const range = useMemo(() => dateRange(dateFilter), [dateFilter])

  const { data, loading, error, refresh } = useAsync(
    () =>
      window.api.prescriptions.list({
        query,
        ...range,
        page,
        pageSize
      }),
    [query, range.dateFrom, range.dateTo, page]
  )

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const toggleSelected = (id: number): void => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const printIds = (ids: number[]): void => {
    if (!ids.length) return
    navigate(`/prescriptions/print?ids=${ids.join(',')}`)
  }

  const exportIds = async (ids: number[]): Promise<void> => {
    if (!ids.length) return
    try {
      const result = await window.api.print.exportPdf(ids)
      showToast(result.path ? `已导出 PDF：${result.path}` : '已取消导出', result.path ? 'success' : 'info')
    } catch (cause) {
      showToast((cause as Error).message, 'error')
    }
  }

  const confirmDelete = async (): Promise<void> => {
    if (!deleting) return
    setDeleteLoading(true)
    try {
      await window.api.prescriptions.remove(deleting.id)
      showToast('处方已删除，库存已退回')
      setDeleting(null)
      setSelected((current) => {
        const next = new Set(current)
        next.delete(deleting.id)
        return next
      })
      refresh()
    } catch (cause) {
      showToast((cause as Error).message, 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div data-testid="prescription-page">
      <PageHeader
        title="处方"
        subtitle={`共 ${total} 张`}
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => navigate('/prescriptions/new')}
            data-testid="add-prescription"
          >
            添加处方
          </Button>
        }
      />
      <div className="toolbar">
        <div className="toolbar-left">
          <SearchInput
            value={query}
            onChange={(value) => {
              setQuery(value)
              setPage(1)
            }}
            placeholder="搜索患者姓名 / 临床诊断"
            testId="prescription-search"
          />
          <Select
            className="date-filter"
            value={dateFilter}
            aria-label="时间筛选"
            data-testid="prescription-date-filter"
            onChange={(event) => {
              setDateFilter(event.target.value as DateFilter)
              setPage(1)
            }}
          >
            <option value="all">全部时间</option>
            <option value="today">今天</option>
            <option value="week">本周</option>
            <option value="month">本月</option>
          </Select>
        </div>
        <div className="toolbar-right">
          <ViewToggle value={viewMode} onChange={(mode) => void setViewMode('prescriptions', mode)} />
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="batch-bar" data-testid="batch-bar">
          <span className="batch-count">已选 {selected.size} 张</span>
          <div className="batch-actions">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={15} />}
              onClick={() => void exportIds([...selected])}
            >
              批量导出 PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              取消选择
            </Button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="rx-grid">
          {[1, 2, 3].map((item) => (
            <div key={item} className="rx-card">
              <div className="skeleton" style={{ height: 18, width: '45%' }} />
              <div className="skeleton" style={{ height: 14, width: '70%', marginTop: 14 }} />
              <div className="skeleton" style={{ height: 14, width: '60%', marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="inline-error">{error.message}</div>
      ) : items.length === 0 ? (
        <EmptyState
          title={query ? '没有找到匹配的处方' : '还没有处方'}
          description={query ? '换个关键词试试。' : '添加第一张处方，库存会自动扣减。'}
          action={
            query ? (
              <Button variant="secondary" onClick={() => setQuery('')}>
                清除搜索
              </Button>
            ) : (
              <Button variant="primary" onClick={() => navigate('/prescriptions/new')}>
                添加处方
              </Button>
            )
          }
        />
      ) : viewMode === 'card' ? (
        <div className="rx-grid">
          {items.map((item) => {
            const checked = selected.has(item.id)
            return (
              <article
                key={item.id}
                className={`rx-card ${checked ? 'selected' : ''}`.trim()}
                data-testid={`rx-card-${item.id}`}
              >
                <label className="rx-card-check" aria-label={`选择 ${item.patientName}`}>
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={checked}
                    onChange={() => toggleSelected(item.id)}
                  />
                </label>
                <div className="rx-card-head">
                  <span className="rx-name">{item.patientName}</span>
                  <span className="rx-meta">
                    {item.gender} · {item.age}
                  </span>
                </div>
                <div className="rx-card-diagnosis">诊断：{item.diagnosis}</div>
                <div className="rx-card-date">开具日期：{item.issueDate}</div>
                <div className="rx-card-meds">用药：{item.medicationText || '—'}</div>
                <div className="rx-card-actions">
                  <Button size="xs" variant="ghost" onClick={() => navigate(`/prescriptions/${item.id}/edit`)}>
                    编辑
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => printIds([item.id])}>
                    打印
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => void exportIds([item.id])}>
                    导出
                  </Button>
                  <Button
                    size="xs"
                    variant="text-danger"
                    icon={<Trash2 size={13} />}
                    onClick={() => setDeleting(item)}
                    data-testid={`rx-delete-${item.id}`}
                  >
                    删除
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="row-check" />
                <th>姓名</th>
                <th>性别</th>
                <th>年龄</th>
                <th>开具日期</th>
                <th className="num">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} data-testid={`rx-row-${item.id}`}>
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleSelected(item.id)}
                      aria-label={`选择 ${item.patientName}`}
                    />
                  </td>
                  <td>{item.patientName}</td>
                  <td>{item.gender}</td>
                  <td>{item.age}</td>
                  <td>{item.issueDate}</td>
                  <td className="actions">
                    <Button size="xs" variant="ghost" onClick={() => navigate(`/prescriptions/${item.id}/edit`)}>
                      编辑
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => printIds([item.id])}>
                      打印
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => void exportIds([item.id])}>
                      导出
                    </Button>
                    <Button size="xs" variant="text-danger" onClick={() => setDeleting(item)}>
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination total={total} page={page} pageSize={pageSize} onChange={setPage} />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="删除这张处方？"
        message={
          deleting
            ? `${deleting.patientName} · ${deleting.issueDate}。删除后将从财务统计中移除，所扣库存会退回。此操作无法撤销。`
            : ''
        }
        confirmText="删除"
        danger
        loading={deleteLoading}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        testId="delete-prescription-dialog"
      />
    </div>
  )
}
