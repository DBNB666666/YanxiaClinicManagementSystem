import type { ClinicApi } from '@shared/types/api'

declare global {
  interface Window {
    api: ClinicApi
  }
}

export {}
