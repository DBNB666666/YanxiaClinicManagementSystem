import type { PrescriptionDetail } from './types/models'
import { formatDateTime } from './date'
import {
  PRINT_CONTENT_LAYOUT,
  buildPrescriptionFooterFields,
  buildPrescriptionHeaderFields,
  countPrescriptionPages,
  getPrescriptionPages
} from './prescriptionPrintLayout'

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
  templateUrl?: string
}

export function buildPrescriptionHtml(
  prescriptions: PrescriptionDetail[],
  options: PrintTemplateOptions = {}
): string {
  const clinicName = options.clinicName ?? '燕霞诊所'
  const printedAt = options.printedAt ?? formatDateTime(new Date().toISOString())
  const totalPages = countPrescriptionPages(prescriptions)
  let pageNumber = 0

  const pages = prescriptions
    .flatMap((prescription) => {
      const contentPages = getPrescriptionPages(prescription)
      return contentPages.map((lines, pageIndex) => {
        pageNumber += 1
        const isLastPage = pageIndex === contentPages.length - 1
        const fields = [
          ...buildPrescriptionHeaderFields(prescription),
          ...buildPrescriptionFooterFields(prescription, isLastPage)
        ]
        if (pageIndex > 0) {
          fields.push({
            key: 'continued',
            text: '续页',
            x: 0.79,
            y: 0.052,
            width: 0.1,
            size: 8
          })
        }

        const fieldHtml = fields
          .map(
            (field) =>
              `<span class="field field-${escapeHtml(field.key)}" style="left:${(field.x * 100).toFixed(
                3
              )}%;top:${(field.y * 100).toFixed(3)}%;width:${(field.width * 100).toFixed(
                3
              )}%;font-size:${field.size}pt;${field.align ? `text-align:${field.align};` : ''}">${escapeHtml(
                field.text
              )}</span>`
          )
          .join('')

        const lineHtml = lines
          .map(
            (line, index) =>
              `<span class="content-line" style="left:${(PRINT_CONTENT_LAYOUT.x * 100).toFixed(
                3
              )}%;top:${(
                (PRINT_CONTENT_LAYOUT.y + index * PRINT_CONTENT_LAYOUT.lineHeight) *
                100
              ).toFixed(3)}%;width:${(PRINT_CONTENT_LAYOUT.width * 100).toFixed(
                3
              )}%;font-size:${PRINT_CONTENT_LAYOUT.fontSize}pt;">${escapeHtml(line)}</span>`
          )
          .join('')

        return `<section class="sheet">
          ${options.templateUrl ? `<img class="template-bg" src="${escapeHtml(options.templateUrl)}" alt="" />` : ''}
          ${fieldHtml}
          ${lineHtml}
          <footer>
            <span>${escapeHtml(clinicName)} · 打印时间：${escapeHtml(printedAt)}</span>
            <span>第 ${pageNumber} / ${totalPages} 页</span>
          </footer>
        </section>`
      })
    })
    .join('\n')

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>处方打印预览</title>
<style>
  @page { size: 130mm 190mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #e9edee; }
  .sheet {
    position: relative; width: 130mm; height: 190mm; box-sizing: border-box;
    margin: 0 auto 8mm; background: #fff; color: #111; overflow: hidden;
    font-family: "SimHei", "黑体", "Microsoft YaHei", sans-serif;
    page-break-after: always; break-after: page;
  }
  .sheet:last-child { page-break-after: auto; break-after: auto; margin-bottom: 0; }
  .template-bg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .field {
    position: absolute; display: block; height: 1.4em; line-height: 1.1;
    white-space: nowrap; overflow: hidden; color: #111;
  }
  .field-diagnosis { overflow: hidden; }
  .content-line {
    position: absolute; display: block; white-space: pre; overflow: hidden;
    line-height: 1.15; color: #111;
  }
  footer {
    position: absolute; left: 4%; right: 4%; bottom: 1.6%;
    display: flex; justify-content: space-between; gap: 4mm;
    color: #555; font-size: 7pt; line-height: 1.2;
  }
  @media screen {
    .sheet { box-shadow: 0 4px 18px rgba(0,0,0,.12); }
  }
</style>
</head>
<body>
${pages}
</body>
</html>`
}
