import type { PrescriptionDetail } from './types/models'
import {
  PRINT_CONTENT_LAYOUT,
  buildPrescriptionFooterFields,
  buildPrescriptionHeaderFields,
  buildPrescriptionSignatureField,
  getPrescriptionPages,
  type SignatureLayout
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
  templateUrl?: string
  signatureImage?: string
  signatureLayout?: SignatureLayout
  hideSignature?: boolean
}

export function buildPrescriptionHtml(
  prescriptions: PrescriptionDetail[],
  options: PrintTemplateOptions = {}
): string {
  const pages = prescriptions
    .flatMap((prescription) => {
      const contentPages = getPrescriptionPages(prescription)
      return contentPages.map((lines, pageIndex) => {
        const isLastPage = pageIndex === contentPages.length - 1
        const fields = [
          ...buildPrescriptionHeaderFields(prescription),
          ...buildPrescriptionFooterFields(prescription, isLastPage)
        ]
        const signatureField = isLastPage
          ? buildPrescriptionSignatureField(
              prescription,
              lines.length,
              options.signatureLayout
            )
          : null
        let signatureHtml = ''
        if (signatureField && !options.hideSignature) {
          if (options.signatureImage) {
            signatureHtml = `<img class="signature-image" src="${escapeHtml(
              options.signatureImage
            )}" alt="医师签名" style="left:${(signatureField.x * 100).toFixed(3)}%;top:${(
              signatureField.y * 100
            ).toFixed(3)}%;width:${(signatureField.width * 100).toFixed(3)}%;" />`
          } else {
            fields.push(signatureField)
          }
        }
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
          ${signatureHtml}
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
  .signature-image {
    position: absolute; display: block; height: auto; max-height: 20%;
    object-fit: contain; object-position: left top;
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
