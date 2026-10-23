import type { PrescriptionDetail } from './types/models'
import { formatCents } from './money'
import { formatDateTime } from './date'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export interface PrintTemplateOptions {
  clinicName?: string
  printedAt?: string
}

export function buildPrescriptionHtml(
  prescriptions: PrescriptionDetail[],
  options: PrintTemplateOptions = {}
): string {
  const clinicName = options.clinicName ?? '燕霞诊所'
  const printedAt = options.printedAt ?? formatDateTime(new Date().toISOString())
  const total = prescriptions.length

  const pages = prescriptions
    .map((prescription, index) => {
      const rows = prescription.items
        .map(
          (item) => `<tr>
            <td>${escapeHtml(item.drugName)}</td>
            <td class="num">${item.qty} ${escapeHtml(item.unit)}</td>
            <td>${escapeHtml([item.usage, item.frequency].filter(Boolean).join('　'))}</td>
            <td class="num">${formatCents(item.amountCents)}</td>
          </tr>`
        )
        .join('')

      return `<section class="page">
        <header>
          <h1>${escapeHtml(clinicName)}</h1>
          <div class="rule"></div>
        </header>
        <div class="patient">
          <span>姓名：${escapeHtml(prescription.patientName)}</span>
          <span>性别：${escapeHtml(prescription.gender)}</span>
          <span>年龄：${escapeHtml(prescription.age)}</span>
          <span>日期：${escapeHtml(prescription.issueDate)}</span>
          <span>医师：${escapeHtml(prescription.doctor)}</span>
        </div>
        <div class="diagnosis">诊断：${escapeHtml(prescription.diagnosis)}</div>
        <div class="rp-title">Rp</div>
        <div class="rp">${escapeHtml(prescription.rp).replaceAll('\n', '<br />')}</div>
        <table>
          <thead><tr><th>药品</th><th>数量</th><th>用法用量</th><th>金额</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="fees">
          <div><span>药品金额</span><span>${formatCents(prescription.drugAmountCents)}</span></div>
          <div><span>注射费</span><span>${formatCents(prescription.injectionFeeCents)}</span></div>
          <div class="total"><span>合计</span><span>${formatCents(prescription.totalCents)}</span></div>
        </div>
        <div class="signature">医师签名：____________________</div>
        <footer>
          <span>打印时间：${escapeHtml(printedAt)}</span>
          <span>第 ${index + 1} / ${total} 页</span>
        </footer>
      </section>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>处方打印预览</title>
<style>
  @page { size: A5 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; background: #e9edee; }
  .page {
    width: 148mm; height: 210mm; box-sizing: border-box;
    padding: 12mm 14mm 14mm; margin: 0 auto 8mm; background: #fff; color: #111;
    font-family: "SimSun", "宋体", serif; font-size: 10.5pt; line-height: 1.6;
    display: flex; flex-direction: column;
  }
  .page:last-child { margin-bottom: 0; }
  header h1 {
    margin: 0; text-align: center; font-family: "SimHei", "黑体", sans-serif;
    font-size: 18pt; font-weight: 600;
  }
  .rule { border-top: 0.6pt solid #000; margin: 3mm 0; }
  .patient { display: flex; flex-wrap: wrap; gap: 2mm 6mm; }
  .diagnosis { margin-top: 2mm; }
  .rp-title { font-weight: 600; font-size: 12pt; margin-top: 3mm; }
  .rp { white-space: normal; word-break: break-all; min-height: 10mm; }
  table { width: 100%; border-collapse: collapse; margin-top: 3mm; }
  th, td { text-align: left; padding: 1.2mm 1mm; border-bottom: 0.5pt solid #999; vertical-align: top; }
  th { font-weight: 600; }
  .num { text-align: right; white-space: nowrap; }
  .fees { margin-top: auto; display: flex; flex-direction: column; gap: 0.8mm; align-items: flex-end; }
  .fees > div { display: flex; justify-content: space-between; width: 62mm; }
  .fees .total { font-weight: 600; border-top: 0.5pt solid #999; padding-top: 1mm; }
  .signature { margin-top: 10mm; }
  footer { display: flex; justify-content: space-between; margin-top: 4mm; font-size: 8.5pt; color: #555; }
  @media screen {
    .page { box-shadow: 0 4px 18px rgba(0,0,0,.12); }
  }
</style>
</head>
<body>
${pages}
</body>
</html>`
}
