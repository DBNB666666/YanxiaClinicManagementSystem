import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { PrescriptionListPage } from './pages/prescriptions/PrescriptionListPage'
import { PrescriptionEditPage } from './pages/prescriptions/PrescriptionEditPage'
import { PrescriptionPrintPage } from './pages/prescriptions/PrescriptionPrintPage'
import { PharmacyListPage } from './pages/pharmacy/PharmacyListPage'
import { DrugEditPage } from './pages/pharmacy/DrugEditPage'
import { DrugDetailPage } from './pages/pharmacy/DrugDetailPage'
import { FinancePage } from './pages/finance/FinancePage'

export function AppRoutes(): React.JSX.Element {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/prescriptions" replace />} />
        <Route path="prescriptions" element={<PrescriptionListPage />} />
        <Route path="prescriptions/new" element={<PrescriptionEditPage />} />
        <Route path="prescriptions/:id/edit" element={<PrescriptionEditPage />} />
        <Route path="prescriptions/print" element={<PrescriptionPrintPage />} />
        <Route path="pharmacy" element={<PharmacyListPage />} />
        <Route path="pharmacy/new" element={<DrugEditPage />} />
        <Route path="pharmacy/:id" element={<DrugDetailPage />} />
        <Route path="pharmacy/:id/edit" element={<DrugEditPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="*" element={<Navigate to="/prescriptions" replace />} />
      </Route>
    </Routes>
  )
}
