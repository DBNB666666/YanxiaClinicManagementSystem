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

export function formatDrugStock(drug: Pick<Drug, 'unit' | 'stockQty' | 'units'>): string {
  const units = drug.units ?? []
  const baseWhole = Math.floor(drug.stockQty)
  if (!units.length) return `${drug.stockQty} ${drug.unit}`
  const smallFactor = totalUnitFactor(units)
  let remainder = Math.round((drug.stockQty - baseWhole) * smallFactor)
  const parts = [`${baseWhole}${drug.unit}`]
  let cumulative = 1
  const counts: number[] = []
  for (const unit of units) {
    cumulative *= Number(unit.factor)
    const unitSize = smallFactor / cumulative
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

export function normalizeUnitInputs(units: DrugUnitInput[] | undefined): DrugUnitInput[] {
  return (units ?? []).filter((unit) => unit.unit.trim() && unit.factor > 0)
}
