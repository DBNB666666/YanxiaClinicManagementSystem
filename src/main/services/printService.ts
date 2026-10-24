import fs from 'node:fs'
import path from 'node:path'
import { shell } from 'electron'
import type { PrescriptionDetail } from '../../shared/types/models'
import { generatePrescriptionPdf } from './pdfService'

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 30) || '处方'
}

export function buildExportFileName(
  prescriptions: PrescriptionDetail[],
  mode: 'single' | 'batch'
): string {
  const today = new Date()
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`
  if (mode === 'single' && prescriptions.length === 1) {
    const item = prescriptions[0]
    return `处方_${safeName(item.patientName)}_${item.issueDate}.pdf`
  }
  return `处方导出_${date}_共${prescriptions.length}张.pdf`
}

export async function exportPrescriptionsPdf(
  prescriptions: PrescriptionDetail[],
  dataDir: string,
  mode: 'single' | 'batch' = prescriptions.length > 1 ? 'batch' : 'single',
  targetPath?: string,
  signatureImage?: string
): Promise<{ path: string; pageCount: number }> {
  const exportsDir = path.join(dataDir, 'exports')
  fs.mkdirSync(exportsDir, { recursive: true })
  const fileName = buildExportFileName(prescriptions, mode)
  const output = targetPath ?? path.join(exportsDir, fileName)
  const result = await generatePrescriptionPdf(prescriptions, output, { signatureImage })
  return { path: result.path, pageCount: result.pageCount }
}

export async function printPrescriptions(
  prescriptions: PrescriptionDetail[],
  dataDir: string,
  signatureImage?: string
): Promise<{ path: string; pageCount: number }> {
  const result = await exportPrescriptionsPdf(
    prescriptions,
    dataDir,
    prescriptions.length > 1 ? 'batch' : 'single',
    undefined,
    signatureImage
  )
  await shell.openPath(result.path)
  return result
}
