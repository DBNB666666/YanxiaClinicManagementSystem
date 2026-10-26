import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { Result } from '../shared/result'
import type { ClinicApi } from '../shared/types/api'
import { ApiError } from '../shared/apiError'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as Result<T>
  if (!result.ok) {
    throw new ApiError(result.error.code, result.error.message, result.error.details)
  }
  return result.data
}

const api: ClinicApi = {
  app: {
    getInfo: () => invoke(IPC.appGetInfo)
  },
  settings: {
    get: () => invoke(IPC.settingsGet),
    set: (patch) => invoke(IPC.settingsSet, patch)
  },
  drugs: {
    list: (query) => invoke(IPC.drugsList, query),
    get: (id) => invoke(IPC.drugsGet, id),
    create: (input) => invoke(IPC.drugsCreate, input),
    update: (id, input) => invoke(IPC.drugsUpdate, { id, input }),
    setStatus: (id, status) => invoke(IPC.drugsSetStatus, { id, status }),
    remove: (id) => invoke(IPC.drugsRemove, id),
    purchase: (input) => invoke(IPC.drugsPurchase, input),
    lowStockCount: () => invoke(IPC.drugsLowStockCount),
    confirmExpiry: (id) => invoke(IPC.drugsConfirmExpiry, id)
  },
  combos: {
    list: () => invoke(IPC.combosList),
    get: (id) => invoke(IPC.combosGet, id),
    create: (input) => invoke(IPC.combosCreate, input),
    update: (id, input) => invoke(IPC.combosUpdate, { id, input }),
    remove: (id) => invoke(IPC.combosRemove, id)
  },
  prescriptions: {
    list: (query) => invoke(IPC.prescriptionsList, query),
    get: (id) => invoke(IPC.prescriptionsGet, id),
    create: (input, allowNegativeStock = false) =>
      invoke(IPC.prescriptionsCreate, { input, allowNegativeStock }),
    update: (id, input, allowNegativeStock = false) =>
      invoke(IPC.prescriptionsUpdate, { id, input, allowNegativeStock }),
    remove: (id) => invoke(IPC.prescriptionsRemove, id)
  },
  finance: {
    summary: (query) => invoke(IPC.financeSummary, query),
    details: (query) => invoke(IPC.financeDetails, query)
  },
  notifications: {
    list: () => invoke(IPC.notificationsList),
    unreadCount: () => invoke(IPC.notificationsUnreadCount),
    markRead: (id) => invoke(IPC.notificationsMarkRead, id),
    markAllRead: () => invoke(IPC.notificationsMarkAllRead)
  },
  print: {
    printPrescription: (ids) => invoke(IPC.printPrescription, ids),
    exportPdf: (ids) => invoke(IPC.printExportPdf, ids)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type PreloadApi = typeof api
