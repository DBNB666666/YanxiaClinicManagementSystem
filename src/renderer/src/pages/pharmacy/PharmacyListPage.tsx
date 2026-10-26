import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import type { Drug, DrugListFilter } from '@shared/types/models'
import { isApiErrorCode } from '@shared/apiError'
import {
  Banner,
  Button,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Tag,
  ViewToggle
} from '../../components/Ui'
import { useAsync } from '../../hooks/useAsync'
import { useSettings } from '../../context/SettingsProvider'
import { useToast } from '../../context/ToastProvider'
import { formatDrugStock } from '@shared/drugUnits'
import { ComboManagerDialog } from './ComboManagerDialog'

export function PharmacyListPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { settings, setViewMode } = useSettings()
  const { showToast } = useToast()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<DrugListFilter>('all')
  const [page, setPage] = useState(1)
  const [deleting, setDeleting] = useState<Drug | null>(null)
  const [stopTarget, setStopTarget] = useState<Drug | null>(null)
  const [busy, setBusy] = useState(false)
  const [comboOpen, setComboOpen] = useState(false)
  const pageSize = 20
  const viewMode = settings.viewModes.pharmacy

  const { data, loading, error, refresh } = useAsync(
    () => window.api.drugs.list({ query, filter, page, pageSize }),
    [query, filter, page]
  )
  const lowStock = useAsync(() => window.api.drugs.lowStockCount(), [])

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const expiringCount = items.filter((drug) => drug.expiring).length

  const refreshAll = (): void => {
    refresh()
    lowStock.refresh()
  }

  const remove = async (): Promise<void> => {
    if (!deleting) return
    setBusy(true)
    try {
      await window.api.drugs.remove(deleting.id)
      showToast('药品已删除')
      setDeleting(null)
      refreshAll()
    } catch (cause) {
      if (isApiErrorCode(cause, 'DRUG_IN_USE')) {
        setStopTarget(deleting)
        setDeleting(null)
      } else {
        showToast((cause as Error).message, 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  const stop = async (): Promise<void> => {
    if (!stopTarget) return
    setBusy(true)
    try {
      await window.api.drugs.setStatus(stopTarget.id, 'stopped')
      showToast(`已停用 ${stopTarget.name}`)
      setStopTarget(null)
      refreshAll()
    } catch (cause) {
      showToast((cause as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const restore = async (drug: Drug): Promise<void> => {
    try {
      await window.api.drugs.setStatus(drug.id, 'active')
      showToast(`${drug.name} 已恢复使用`)
      refreshAll()
    } catch (cause) {
      showToast((cause as Error).message, 'error')
    }
  }

  return (
    <div data-testid="pharmacy-page">
      <PageHeader
        title="药品"
        subtitle={`共 ${total} 种`}
        actions={
          <div className="flex gap-8">
            <Button
              variant="secondary"
              onClick={() => setComboOpen(true)}
              data-testid="manage-combos"
            >
              用药组合
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => navigate('/pharmacy/new')}
              data-testid="add-drug"
            >
              添加药品
            </Button>
          </div>
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
            placeholder="搜索药品名称 / 分类 / 供应商"
            testId="drug-search"
          />
          <Select
            value={filter}
            style={{ width: 150 }}
            aria-label="药品状态筛选"
            data-testid="drug-filter"
            onChange={(event) => {
              setFilter(event.target.value as DrugListFilter)
              setPage(1)
            }}
          >
            <option value="all">全部药品</option>
            <option value="low">仅看库存预警</option>
            <option value="stopped">仅看停用</option>
          </Select>
        </div>
        <div className="toolbar-right">
          <ViewToggle value={viewMode} onChange={(mode) => void setViewMode('pharmacy', mode)} />
        </div>
      </div>

      {expiringCount > 0 ? (
        <Banner tone="warning">
          请注意，有 {expiringCount} 种药品还有一个半月过期
        </Banner>
      ) : null}

      {lowStock.data && lowStock.data.count > 0 && filter !== 'low' ? (
        <Banner
          tone="warning"
          action={
            <Button variant="ghost" size="sm" onClick={() => setFilter('low')}>
              查看
            </Button>
          }
        >
          有 {lowStock.data.count} 种药品库存低于预警值
        </Banner>
      ) : null}

      {loading ? (
        <div className="muted">正在加载药品…</div>
      ) : error ? (
        <div className="inline-error">{error.message}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle size={22} />}
          title={query ? '没有找到匹配的药品' : '药房还是空的'}
          description={query ? '换个关键词试试。' : '先添加第一种药品，才能开处方。'}
          action={
            query ? (
              <Button variant="secondary" onClick={() => setQuery('')}>
                清除搜索
              </Button>
            ) : (
              <Button variant="primary" onClick={() => navigate('/pharmacy/new')}>
                添加药品
              </Button>
            )
          }
        />
      ) : viewMode === 'card' ? (
        <div className="pharmacy-grid">
          {items.map((drug) => {
            const low = drug.status === 'active' && drug.stockQty <= drug.warningQty
            return (
              <article
                key={drug.id}
                className="pharmacy-card pharmacy-card-clickable"
                data-testid={`drug-card-${drug.id}`}
                role="link"
                tabIndex={0}
                aria-label={`查看 ${drug.name} 详情`}
                onClick={() => navigate(`/pharmacy/${drug.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(`/pharmacy/${drug.id}`)
                  }
                }}
              >
                <div className="pharmacy-card-head">
                  <span className="pharmacy-name">{drug.name}</span>
                </div>
                <div className="pharmacy-card-badge">
                  {drug.status === 'stopped' ? (
                    <Tag tone="muted">已停用</Tag>
                  ) : low ? (
                    <Tag tone="warning">库存预警</Tag>
                  ) : drug.expiring ? (
                    <Tag tone="warning">即将过期</Tag>
                  ) : null}
                </div>
                <div className="pharmacy-sub">入库：{drug.inboundDate}</div>
                <div className={`pharmacy-stock ${low ? 'low' : ''}`.trim()}>
                  {formatDrugStock(drug)}
                </div>
                <div className="pharmacy-meta">
                  <span>分类：{drug.category || '未分类'}</span>
                  <span>供应商：{drug.supplier || '—'}</span>
                </div>
                <div
                  className="pharmacy-card-actions"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button size="xs" variant="ghost" onClick={() => navigate(`/pharmacy/${drug.id}/edit`)}>
                    编辑
                  </Button>
                  {drug.status === 'stopped' ? (
                    <Button size="xs" variant="ghost" onClick={() => void restore(drug)}>
                      恢复使用
                    </Button>
                  ) : (
                    <Button size="xs" variant="ghost" onClick={() => navigate(`/pharmacy/${drug.id}`)}>
                      停用
                    </Button>
                  )}
                  <Button
                    size="xs"
                    variant="text-danger"
                    icon={<Trash2 size={13} />}
                    onClick={() => setDeleting(drug)}
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
                <th>名称</th>
                <th>入库日期</th>
                <th className="num">库存</th>
                <th>分类</th>
                <th className="num">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((drug) => {
                const low = drug.status === 'active' && drug.stockQty <= drug.warningQty
                return (
                  <tr key={drug.id} data-testid={`drug-row-${drug.id}`}>
                    <td>
                      {drug.name}
                      {drug.status === 'stopped' ? (
                        <span style={{ marginLeft: 8 }}>
                          <Tag tone="muted">已停用</Tag>
                        </span>
                      ) : null}
                    </td>
                    <td>{drug.inboundDate}</td>
                    <td className={`num ${low ? 'warning-text' : ''}`.trim()}>
                      {formatDrugStock(drug)}
                    </td>
                    <td>{drug.category || '未分类'}</td>
                    <td className="actions">
                      <Button size="xs" variant="ghost" onClick={() => navigate(`/pharmacy/${drug.id}`)}>
                        详情
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => navigate(`/pharmacy/${drug.id}/edit`)}>
                        编辑
                      </Button>
                      <Button size="xs" variant="ghost" onClick={() => setDeleting(drug)}>
                        删除
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination total={total} page={page} pageSize={pageSize} onChange={setPage} />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="删除这种药品？"
        message={
          deleting ? `${deleting.name}。如果已被处方使用，将无法删除，只能停用。` : ''
        }
        confirmText="删除"
        danger
        loading={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={() => void remove()}
        testId="delete-drug-dialog"
      />

      <ConfirmDialog
        open={Boolean(stopTarget)}
        title="这种药品不能删除"
        message={
          stopTarget
            ? `${stopTarget.name} 已被处方使用或有进货记录。为保证历史处方和账本准确，只能停用。`
            : ''
        }
        confirmText="停用"
        loading={busy}
        onCancel={() => setStopTarget(null)}
        onConfirm={() => void stop()}
        testId="stop-drug-dialog"
      />
      <ComboManagerDialog open={comboOpen} onClose={() => setComboOpen(false)} />
    </div>
  )
}
