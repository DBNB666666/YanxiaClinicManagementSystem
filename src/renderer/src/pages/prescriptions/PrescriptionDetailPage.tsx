import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Printer, Trash2 } from 'lucide-react'
import { formatCents, formatProfit } from '@shared/money'
import { formatDateTime } from '@shared/date'
import { mergeUsage } from '@shared/prescriptionUsage'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  PageHeader
} from '../../components/Ui'
import { Breadcrumbs } from '../../components/Breadcrumbs'
import { useAsync } from '../../hooks/useAsync'
import { useToast } from '../../context/ToastProvider'

export function PrescriptionDetailPage(): React.JSX.Element {
  const { id } = useParams()
  const prescriptionId = Number(id)
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { data: prescription, loading, error } = useAsync(
    () => window.api.prescriptions.get(prescriptionId),
    [prescriptionId]
  )

  const remove = async (): Promise<void> => {
    if (!prescription) return
    setDeleting(true)
    try {
      await window.api.prescriptions.remove(prescription.id)
      showToast('处方已删除，库存已退回')
      navigate('/prescriptions')
    } catch (cause) {
      showToast((cause as Error).message, 'error')
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  if (loading) return <div className="muted">正在加载处方…</div>
  if (error) return <div className="inline-error">{error.message}</div>
  if (!prescription) {
    return (
      <EmptyState
        title="处方不存在"
        description="这张处方可能已经被删除。"
        action={
          <Button variant="primary" onClick={() => navigate('/prescriptions')}>
            返回处方列表
          </Button>
        }
      />
    )
  }

  const profit = prescription.totalCents - prescription.costCents

  return (
    <div data-testid="prescription-detail-page">
      <Breadcrumbs
        items={[
          { label: '处方', to: '/prescriptions' },
          { label: prescription.patientName },
          { label: '处方详情' }
        ]}
      />
      <PageHeader
        title="处方详情"
        subtitle={`${prescription.patientName} · ${prescription.issueDate}`}
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft size={16} />}
              onClick={() => navigate('/prescriptions')}
            >
              返回处方
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Pencil size={15} />}
              onClick={() => navigate(`/prescriptions/${prescription.id}/edit`)}
              data-testid="detail-edit"
            >
              编辑
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Printer size={15} />}
              onClick={() => navigate(`/prescriptions/print?ids=${prescription.id}`)}
              data-testid="detail-print"
            >
              打印
            </Button>
            <Button
              variant="text-danger"
              size="sm"
              icon={<Trash2 size={15} />}
              onClick={() => setDeleteOpen(true)}
              data-testid="detail-delete"
            >
              删除
            </Button>
          </>
        }
      />

      <div className="detail-layout">
        <div>
          <section className="detail-panel">
            <h2 className="detail-panel-title">患者信息</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">姓名</span>
                <span className="info-value" data-testid="detail-patient-name">
                  {prescription.patientName}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">性别 / 年龄</span>
                <span className="info-value">
                  {prescription.gender} · {prescription.age}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">开具日期</span>
                <span className="info-value">{prescription.issueDate}</span>
              </div>
              <div className="info-item">
                <span className="info-label">医师</span>
                <span className="info-value">{prescription.doctor}</span>
              </div>
              <div className="info-item">
                <span className="info-label">临床诊断</span>
                <span className="info-value">{prescription.diagnosis}</span>
              </div>
              <div className="info-item">
                <span className="info-label">用药数量</span>
                <span className="info-value">{prescription.items.length} 种</span>
              </div>
            </div>
          </section>

          <section className="detail-panel">
            <h2 className="detail-panel-title">用药明细</h2>
            {prescription.items.length === 0 ? (
              <div className="med-empty">没有用药记录</div>
            ) : (
              <div className="table-wrap detail-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>药品</th>
                      <th className="num">数量</th>
                      <th>用法</th>
                      <th className="num">单价</th>
                      <th className="num">金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescription.items.map((item) => (
                      <tr key={item.id} data-testid={`detail-medication-${item.drugId}`}>
                        <td>
                          <div className="med-drug-name">{item.drugName}</div>
                          <div className="med-drug-stock">单位：{item.unit}</div>
                        </td>
                        <td className="num">
                          {item.qty} {item.unit}
                        </td>
                        <td>{mergeUsage(item.usage, item.frequency) || '—'}</td>
                        <td className="num money">{formatCents(item.unitPriceCents)}</td>
                        <td className="num money">{formatCents(item.amountCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside>
          <section className="detail-panel">
            <h2 className="detail-panel-title">费用</h2>
            <div className="fee-row">
              <span className="fee-label">药品金额</span>
              <span className="fee-value">{formatCents(prescription.drugAmountCents)}</span>
            </div>
            <div className="fee-row">
              <span className="fee-label">注射费</span>
              <span className="fee-value">{formatCents(prescription.injectionFeeCents)}</span>
            </div>
            <div className="fee-row fee-total">
              <span>应收合计</span>
              <span className="fee-value" data-testid="detail-total">
                {formatCents(prescription.totalCents)}
              </span>
            </div>
            <div className="fee-row" style={{ marginTop: 10 }}>
              <span className="fee-label">成本</span>
              <span className="fee-value">{formatCents(prescription.costCents)}</span>
            </div>
            <div className="fee-row">
              <span className="fee-label">毛利</span>
              <span className={`fee-value ${profit >= 0 ? 'positive' : 'negative'}`.trim()}>
                {formatProfit(profit)}
              </span>
            </div>
          </section>

          <section className="detail-panel">
            <h2 className="detail-panel-title">记录</h2>
            <div className="muted detail-timestamps">
              创建：{formatDateTime(prescription.createdAt)}
              <br />
              更新：{formatDateTime(prescription.updatedAt)}
            </div>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="删除这张处方？"
        message={`${prescription.patientName} · ${prescription.issueDate}。删除后将从财务统计中移除，所扣库存会退回。此操作无法撤销。`}
        confirmText="删除"
        danger
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void remove()}
        testId="delete-prescription-detail-dialog"
      />
    </div>
  )
}
