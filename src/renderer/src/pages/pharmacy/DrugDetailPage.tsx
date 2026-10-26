import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, PackagePlus, Pencil, Power } from 'lucide-react'
import type { DrugDetail } from '@shared/types/models'
import { formatDateTime } from '@shared/date'
import { Banner, Button, EmptyState, PageHeader, Tag } from '../../components/Ui'
import { useToast } from '../../context/ToastProvider'
import { formatDrugStock, formatDrugUnitTotals } from '@shared/drugUnits'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { PurchaseDialog } from './PurchaseDialog'

export function DrugDetailPage(): React.JSX.Element {
  const { id } = useParams()
  const drugId = Number(id)
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [drug, setDrug] = useState<DrugDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const detail = await window.api.drugs.get(drugId)
      setDrug(detail)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setLoading(false)
    }
  }, [drugId])

  useEffect(() => {
    void load()
  }, [load])

  const toggleStatus = async (): Promise<void> => {
    if (!drug) return
    setBusy(true)
    try {
      const next = drug.status === 'active' ? 'stopped' : 'active'
      await window.api.drugs.setStatus(drug.id, next)
      showToast(next === 'stopped' ? '药品已停用' : '药品已恢复使用')
      await load()
    } catch (cause) {
      showToast((cause as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <div className="muted">正在加载药品…</div>
  if (error) return <div className="inline-error">{error}</div>
  if (!drug) return <EmptyState title="药品不存在" />

  const low = drug.status === 'active' && drug.stockQty <= drug.warningQty

  return (
    <div data-testid="drug-detail-page">
      <Breadcrumbs
        items={[
          { label: '药房', to: '/pharmacy' },
          { label: drug.name },
          { label: '药品详情' }
        ]}
      />
      <PageHeader
        title={drug.name}
        subtitle={
          <Tag tone={drug.status === 'stopped' ? 'muted' : low ? 'warning' : 'success'}>
            {drug.status === 'stopped' ? '已停用' : low ? '库存预警' : '库存正常'}
          </Tag>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={() => navigate('/pharmacy')}>
              返回药房
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Pencil size={15} />}
              onClick={() => navigate(`/pharmacy/${drug.id}/edit`)}
            >
              编辑
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Power size={15} />}
              loading={busy}
              onClick={() => void toggleStatus()}
              data-testid="toggle-drug-status"
            >
              {drug.status === 'active' ? '停用' : '恢复使用'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<PackagePlus size={15} />}
              onClick={() => setPurchaseOpen(true)}
              data-testid="purchase-button"
            >
              进货
            </Button>
          </>
        }
      />

      {low ? (
        <Banner
          tone="warning"
          action={
            <Button variant="ghost" size="sm" onClick={() => setPurchaseOpen(true)}>
              马上进货
            </Button>
          }
        >
          库存偏低：当前 {drug.stockQty} {drug.unit}，预警值 {drug.warningQty} {drug.unit}
        </Banner>
      ) : null}

      <div className="detail-layout">
        <div>
          <section className="detail-panel">
            <div className="stock-hero">
              <span className={`stock-number ${low ? 'warning-text' : ''}`.trim()}>
                {formatDrugStock(drug)}
              </span>
            </div>
            <div className="stock-sub">
              预警值：{drug.warningQty} {drug.unit} · 入库日期：{drug.inboundDate}
            </div>
            <div className="stock-sub" data-testid="stock-unit-totals">
              合计：{formatDrugUnitTotals(drug)}
            </div>
          </section>

          <section className="detail-panel">
            <h2 className="detail-panel-title">基本信息</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">分类</span>
                <span className="info-value">{drug.category || '未分类'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">供应商</span>
                <span className="info-value">{drug.supplier || '—'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">开药次数</span>
                <span className="info-value">{drug.usageCount} 次</span>
              </div>
              <div className="info-item">
                <span className="info-label">状态</span>
                <span className="info-value">{drug.status === 'active' ? '正常使用' : '已停用'}</span>
              </div>
            </div>
            <h3 className="detail-panel-title" style={{ marginTop: 20, fontSize: 14 }}>
              适应症
            </h3>
            <div className="indications">{drug.indications || '—'}</div>
          </section>
        </div>

        <div>
          <section className="detail-panel">
            <h2 className="detail-panel-title">进货记录</h2>
            {drug.purchases.length === 0 ? (
              <EmptyState title="还没有进货记录" description="点右上角“进货”记录第一笔。" />
            ) : (
              <div className="purchase-list">
                <div className="purchase-row purchase-head" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <span>日期</span>
                  <span>数量</span>
                </div>
                {drug.purchases.map((purchase) => (
                  <div key={purchase.id} className="purchase-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <span>{purchase.purchaseDate}</span>
                    <span>
                      {purchase.qty} {drug.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="detail-panel">
            <h2 className="detail-panel-title">操作记录</h2>
            <div className="muted" style={{ fontSize: 13 }}>
              创建：{formatDateTime(drug.createdAt)}
              <br />
              更新：{formatDateTime(drug.updatedAt)}
            </div>
          </section>
        </div>
      </div>

      <PurchaseDialog
        open={purchaseOpen}
        drug={drug}
        onClose={() => setPurchaseOpen(false)}
        onSuccess={() => void load()}
      />
    </div>
  )
}
