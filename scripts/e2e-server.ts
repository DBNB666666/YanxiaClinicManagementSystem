import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { SqliteStore } from '../src/main/db/store'
import { ClinicService } from '../src/main/services/clinicService'
import { generatePrescriptionPdf } from '../src/main/services/pdfService'
import { todayIso } from '../src/shared/date'
import { fail, ok } from '../src/shared/result'
import type { PrescriptionInput } from '../src/shared/types/models'

const root = process.cwd()
const rendererDir = path.join(root, 'out', 'renderer')
const dataRoot = path.join(root, '.tmp', 'e2e-data')
const exportDir = path.join(root, '.tmp', 'e2e-exports')

let store: SqliteStore | null = null
let service: ClinicService

function seedDefault(current: ClinicService): void {
  current.createDrug({
    name: '阿莫西林胶囊',
    unit: '盒',
    inboundDate: '2026-10-01',
    stockQty: 10,
    warningQty: 5,
    category: '抗生素',
    supplier: '华康医药',
    indications: '用于敏感菌感染',
    costCents: 800,
    priceCents: 1800
  })
  current.createDrug({
    name: '布洛芬缓释胶囊',
    unit: '盒',
    inboundDate: '2026-09-28',
    stockQty: 3,
    warningQty: 5,
    category: '解热镇痛',
    supplier: '华康医药',
    indications: '用于发热疼痛',
    costCents: 500,
    priceCents: 1200
  })
  current.createDrug({
    name: '生理盐水',
    unit: '瓶',
    inboundDate: '2026-09-20',
    stockQty: 0,
    warningQty: 5,
    category: '输液',
    supplier: '康源',
    indications: '补液',
    costCents: 200,
    priceCents: 500
  })
  current.createDrug({
    name: '创可贴',
    unit: '包',
    inboundDate: '2026-09-10',
    stockQty: 20,
    warningQty: 20,
    category: '外用',
    supplier: '康源',
    indications: '小创口',
    costCents: 100,
    priceCents: 300
  })
  const p1: PrescriptionInput = {
    patientName: '张秀兰',
    gender: '女',
    age: '62',
    diagnosis: '高血压、失眠',
    issueDate: todayIso(),
    rp: '注意休息，低盐饮食。',
    doctor: '王医生',
    items: [
      { drugId: 1, qty: 2, usage: '口服', frequency: '每日1次' },
      { drugId: 2, qty: 1, usage: '口服', frequency: '每日2次' }
    ],
    injectionFeeCents: 2000
  }
  current.createPrescription(p1)
  current.markAllNotificationsRead()
}

async function reset(seed: 'default' | 'empty'): Promise<void> {
  store?.close()
  store = null
  fs.rmSync(dataRoot, { recursive: true, force: true })
  fs.mkdirSync(dataRoot, { recursive: true })
  store = await SqliteStore.open({ dbPath: path.join(dataRoot, 'clinic.db') })
  service = new ClinicService(store)
  if (seed === 'default') seedDefault(service)
}

async function exportPdf(ids: number[]): Promise<{ path: string; pageCount: number }> {
  const details = service.getPrescriptionsForPrint(ids)
  fs.mkdirSync(exportDir, { recursive: true })
  const fileName =
    details.length === 1
      ? `处方_${details[0].patientName}_${details[0].issueDate}.pdf`
      : `处方导出_2026-10-23_共${details.length}张.pdf`
  const output = path.join(exportDir, fileName.replace(/[\\/:*?"<>|]/g, '_'))
  const result = await generatePrescriptionPdf(details, output)
  return { path: result.path, pageCount: result.pageCount }
}

async function dispatch(ns: string, method: string, args: unknown[]): Promise<unknown> {
  if (ns === 'app' && method === 'getInfo') {
    return { version: '0.1.0', dataDir: dataRoot, lastBackupAt: null }
  }
  if (ns === 'settings' && method === 'get') return service.getSettings()
  if (ns === 'settings' && method === 'set') return service.setSettings(args[0] as never)
  if (ns === 'drugs') {
    if (method === 'list') return service.listDrugs(args[0] as never)
    if (method === 'get') return service.getDrug(Number(args[0]))
    if (method === 'create') return service.createDrug(args[0] as never)
    if (method === 'update') return service.updateDrug(Number(args[0]), args[1] as never)
    if (method === 'setStatus') {
      const payload =
        args[0] && typeof args[0] === 'object' && 'id' in (args[0] as object)
          ? (args[0] as { id: number; status: 'active' | 'stopped' })
          : { id: Number(args[0]), status: args[1] as 'active' | 'stopped' }
      return service.setDrugStatus(payload.id, payload.status)
    }
    if (method === 'remove') return service.deleteDrug(Number(args[0]))
    if (method === 'purchase') return service.purchaseDrug(args[0] as never)
    if (method === 'lowStockCount') return service.lowStockCount()
  }
  if (ns === 'prescriptions') {
    if (method === 'list') return service.listPrescriptions(args[0] as never)
    if (method === 'get') return service.getPrescription(Number(args[0]))
    if (method === 'create') {
      const first = args[0] as { input?: PrescriptionInput; allowNegativeStock?: boolean }
      const wrapped = Boolean(first && typeof first === 'object' && 'input' in first)
      const input = (wrapped ? first.input : args[0]) as PrescriptionInput
      const allow = wrapped ? first.allowNegativeStock : args[1]
      return service.createPrescription(input, Boolean(allow))
    }
    if (method === 'update') {
      const first = args[0] as {
        id?: number
        input?: PrescriptionInput
        allowNegativeStock?: boolean
      }
      const wrapped = Boolean(first && typeof first === 'object' && 'input' in first)
      const id = wrapped ? Number(first.id) : Number(args[0])
      const input = (wrapped ? first.input : args[1]) as PrescriptionInput
      const allow = wrapped ? first.allowNegativeStock : args[2]
      return service.updatePrescription(id, input, Boolean(allow))
    }
    if (method === 'remove') return service.deletePrescription(Number(args[0]))
  }
  if (ns === 'finance') {
    if (method === 'summary') return service.financeSummary(args[0] as never)
    if (method === 'details') return service.financeDetails(args[0] as never)
  }
  if (ns === 'notifications') {
    if (method === 'list') return service.listNotifications()
    if (method === 'unreadCount') return service.unreadNotificationCount()
    if (method === 'markRead') return service.markNotificationRead(Number(args[0]))
    if (method === 'markAllRead') return service.markAllNotificationsRead()
  }
  if (ns === 'print') {
    if (method === 'exportPdf' || method === 'printPrescription') {
      return exportPdf((args[0] as number[]) ?? [])
    }
  }
  throw new Error(`未知 API：${ns}.${method}`)
}

function mimeFor(file: string): string {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8'
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8'
  if (file.endsWith('.css')) return 'text/css; charset=utf-8'
  if (file.endsWith('.json')) return 'application/json; charset=utf-8'
  if (file.endsWith('.png')) return 'image/png'
  if (file.endsWith('.svg')) return 'image/svg+xml'
  if (file.endsWith('.woff2')) return 'font/woff2'
  return 'application/octet-stream'
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1:4173')
    if (url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('ok')
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/__reset') {
      const body = JSON.parse((await readBody(req)) || '{}') as { seed?: 'default' | 'empty' }
      await reset(body.seed === 'empty' ? 'empty' : 'default')
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ ok: true, data: { reset: true } }))
      return
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      const methodPath = url.pathname.slice('/api/'.length)
      const dot = methodPath.indexOf('.')
      const ns = methodPath.slice(0, dot)
      const method = methodPath.slice(dot + 1)
      const raw = await readBody(req)
      const payload = raw ? (JSON.parse(raw) as { args?: unknown[] }) : {}
      try {
        const data = await dispatch(ns, method, payload.args ?? [])
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(ok(data)))
      } catch (error) {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(fail(error)))
      }
      return
    }

    let filePath = path.join(rendererDir, decodeURIComponent(url.pathname))
    if (url.pathname === '/' || url.pathname === '') filePath = path.join(rendererDir, 'index.html')
    const resolved = path.resolve(filePath)
    if (!resolved.startsWith(path.resolve(rendererDir))) {
      res.writeHead(403)
      res.end('forbidden')
      return
    }
    if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      filePath = path.join(rendererDir, 'index.html')
    }
    const content = fs.readFileSync(filePath)
    res.writeHead(200, { 'content-type': mimeFor(filePath) })
    res.end(content)
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
    res.end((error as Error).message)
  }
})

async function main(): Promise<void> {
  await reset('default')
  server.listen(4173, '127.0.0.1', () => {
    console.log('e2e server http://127.0.0.1:4173')
  })
}

void main()

process.on('SIGINT', () => {
  store?.close()
  server.close(() => process.exit(0))
})
