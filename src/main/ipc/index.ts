import { dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import type { AppInfo, PrescriptionInput } from '../../shared/types/models'
import type { FinanceDetailsQuery, FinanceQuery } from '../../shared/types/models'
import { fail, ok } from '../../shared/result'
import { IPC } from '../../shared/ipc'
import type { ClinicService } from '../services/clinicService'
import {
  buildExportFileName,
  exportPrescriptionsPdf,
  printPrescriptions
} from '../services/printService'

interface RegisterOptions {
  service: ClinicService
  dataDir: string
  getAppInfo: () => AppInfo
}

function wrap<T>(fn: () => T | Promise<T>) {
  return async () => {
    try {
      return ok(await fn())
    } catch (error) {
      return fail(error)
    }
  }
}

function wrapWithArg<T, A>(fn: (arg: A) => T | Promise<T>) {
  return async (_event: unknown, arg: A) => {
    try {
      return ok(await fn(arg))
    } catch (error) {
      return fail(error)
    }
  }
}

export function registerIpc({ service, dataDir, getAppInfo }: RegisterOptions): void {
  ipcMain.handle(IPC.ping, async () => ok('pong'))
  ipcMain.handle(IPC.appGetInfo, wrap(() => getAppInfo()))
  ipcMain.handle(IPC.settingsGet, wrap(() => service.getSettings()))
  ipcMain.handle(IPC.settingsSet, wrapWithArg((patch) => service.setSettings(patch)))

  ipcMain.handle(IPC.drugsList, wrapWithArg((query) => service.listDrugs(query)))
  ipcMain.handle(IPC.drugsGet, wrapWithArg((id: number) => service.getDrug(id)))
  ipcMain.handle(IPC.drugsCreate, wrapWithArg((input) => service.createDrug(input)))
  ipcMain.handle(IPC.drugsUpdate, wrapWithArg(({ id, input }) => service.updateDrug(id, input)))
  ipcMain.handle(IPC.drugsSetStatus, wrapWithArg(({ id, status }) => service.setDrugStatus(id, status)))
  ipcMain.handle(IPC.drugsRemove, wrapWithArg((id: number) => service.deleteDrug(id)))
  ipcMain.handle(IPC.drugsPurchase, wrapWithArg((input) => service.purchaseDrug(input)))
  ipcMain.handle(IPC.drugsLowStockCount, wrap(() => service.lowStockCount()))

  ipcMain.handle(IPC.combosList, wrap(() => service.listCombos()))
  ipcMain.handle(IPC.combosGet, wrapWithArg((id: number) => service.getCombo(id)))
  ipcMain.handle(IPC.combosCreate, wrapWithArg((input) => service.createCombo(input)))
  ipcMain.handle(IPC.combosUpdate, wrapWithArg(({ id, input }) => service.updateCombo(id, input)))
  ipcMain.handle(IPC.combosRemove, wrapWithArg((id: number) => service.deleteCombo(id)))

  ipcMain.handle(IPC.prescriptionsList, wrapWithArg((query) => service.listPrescriptions(query)))
  ipcMain.handle(IPC.prescriptionsGet, wrapWithArg((id: number) => service.getPrescription(id)))
  ipcMain.handle(
    IPC.prescriptionsCreate,
    wrapWithArg(({ input, allowNegativeStock }: { input: PrescriptionInput; allowNegativeStock?: boolean }) =>
      service.createPrescription(input, Boolean(allowNegativeStock))
    )
  )
  ipcMain.handle(
    IPC.prescriptionsUpdate,
    wrapWithArg(
      ({
        id,
        input,
        allowNegativeStock
      }: {
        id: number
        input: PrescriptionInput
        allowNegativeStock?: boolean
      }) => service.updatePrescription(id, input, Boolean(allowNegativeStock))
    )
  )
  ipcMain.handle(IPC.prescriptionsRemove, wrapWithArg((id: number) => service.deletePrescription(id)))

  ipcMain.handle(IPC.financeSummary, wrapWithArg((query: FinanceQuery) => service.financeSummary(query)))
  ipcMain.handle(
    IPC.financeDetails,
    wrapWithArg((query: FinanceDetailsQuery) => service.financeDetails(query))
  )

  ipcMain.handle(IPC.notificationsList, wrap(() => service.listNotifications()))
  ipcMain.handle(IPC.notificationsUnreadCount, wrap(() => service.unreadNotificationCount()))
  ipcMain.handle(IPC.notificationsMarkRead, wrapWithArg((id: number) => service.markNotificationRead(id)))
  ipcMain.handle(IPC.notificationsMarkAllRead, wrap(() => service.markAllNotificationsRead()))

  ipcMain.handle(IPC.printPrescription, wrapWithArg(async (ids: number[]) => {
    const prescriptions = service.getPrescriptionsForPrint(ids)
    const settings = service.getSettings()
    return printPrescriptions(prescriptions, dataDir, settings.signatureImage, {
      x: settings.signatureX,
      y: settings.signatureY,
      width: settings.signatureWidth
    })
  }))
  ipcMain.handle(IPC.printExportPdf, wrapWithArg(async (ids: number[]) => {
    const prescriptions = service.getPrescriptionsForPrint(ids)
    const mode = prescriptions.length > 1 ? 'batch' : 'single'
    const result = await dialog.showSaveDialog({
      title: '导出处方 PDF',
      defaultPath: join(dataDir, 'exports', buildExportFileName(prescriptions, mode)),
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
    })
    if (result.canceled || !result.filePath) {
      return { path: '', pageCount: 0 }
    }
    return exportPrescriptionsPdf(
      prescriptions,
      dataDir,
      mode,
      result.filePath,
      service.getSettings().signatureImage,
      {
        x: service.getSettings().signatureX,
        y: service.getSettings().signatureY,
        width: service.getSettings().signatureWidth
      }
    )
  }))
}
