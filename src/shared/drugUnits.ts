import type { Drug, DrugUnit, DrugUnitInput } from './types/models'

export interface UnitChoice {
  unit: string
  factor: number
  priceCents: number
  costCents: number
}

export function totalUnitFactor(units: Pick<DrugUnit, 'factor'>[]): number {
  return units.reduce((total, unit) => total * Number(unit.factor), 1)
}

export function drugUnitChoices(drug: Pick<Drug, 'unit' | 'priceCents' | 'costCents' | 'units'>): UnitChoice[] {
  const choices: UnitChoice[] = [
    {
      unit: drug.unit,
      factor: 1,
      priceCents: drug.priceCents,
      costCents: drug.costCents
    }
  ]
  let factor = 1
  for (const unit of drug.units ?? []) {
    factor *= Number(unit.factor)
    choices.push({
      unit: unit.unit,
      factor,
      priceCents: unit.priceCents,
      costCents: unit.costCents
    })
  }
  return choices
}

export function formatDrugStock(
  drug: Pick<Drug, 'unit' | 'stockQty' | 'units'> & { stockUnits?: number }
): string {
  const units = drug.units ?? []
  const totalFactor = totalUnitFactor(units)
  const smallest =
    drug.stockUnits !== undefined
      ? Math.round(drug.stockUnits)
      : Math.round(drug.stockQty * totalFactor)
  const baseWhole = Math.floor(smallest / totalFactor)
  if (!units.length) return `${drug.stockQty} ${drug.unit}`
  let remainder = smallest - baseWhole * totalFactor
  const parts = [`${baseWhole}${drug.unit}`]
  let cumulative = 1
  const counts: number[] = []
  for (const unit of units) {
    cumulative *= Number(unit.factor)
    const unitSize = totalFactor / cumulative
    const whole = Math.floor(remainder / unitSize)
    remainder -= whole * unitSize
    counts.push(whole)
  }
  while (counts.length && counts[counts.length - 1] === 0) counts.pop()
  counts.forEach((count, index) => {
    if (count > 0) parts.push(`${count}${units[index].unit}`)
  })
  return parts.join(' ')
}

export function formatDrugUnitTotals(
  drug: Pick<Drug, 'unit' | 'stockQty' | 'units'> & { stockUnits?: number }
): string {
  const units = drug.units ?? []
  if (!units.length) return `${drug.stockQty} ${drug.unit}`
  const totalFactor = totalUnitFactor(units)
  const smallest =
    drug.stockUnits !== undefined
      ? Math.round(drug.stockUnits)
      : Math.round(drug.stockQty * totalFactor)
  const parts: string[] = []
  let cumulative = 1
  parts.push(`${Math.floor(smallest / totalFactor)}${drug.unit}`)
  for (const unit of units) {
    cumulative *= Number(unit.factor)
    const unitSize = totalFactor / cumulative
    parts.push(`${Math.floor(smallest / unitSize)}${unit.unit}`)
  }
  return parts.join(' · ')
}

export function normalizeUnitInputs(units: DrugUnitInput[] | undefined): DrugUnitInput[] {
  return (units ?? []).filter((unit) => unit.unit.trim() && unit.factor > 0)
}
