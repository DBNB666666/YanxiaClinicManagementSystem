import { z } from 'zod'
import { isFutureDate, isValidIsoDate } from './date'

export const dateStringSchema = z
  .string()
  .refine((value) => isValidIsoDate(value), '日期格式应为 YYYY-MM-DD')

export const pastOrTodaySchema = dateStringSchema.refine(
  (value) => !isFutureDate(value),
  '不允许未来日期'
)

export const genderSchema = z.enum(['男', '女'])
export const themeSchema = z.enum(['light', 'dark', 'reading'])
export const viewModeSchema = z.enum(['card', 'list'])
export const drugStatusSchema = z.enum(['active', 'stopped'])
export const financePeriodSchema = z.enum(['day', 'week', 'month', 'year'])

export const drugInputSchema = z.object({
  name: z.string().trim().min(1, '请填写药品名称').max(40, '药品名称最多 40 字'),
  unit: z.string().trim().min(1, '请填写单位').max(8, '单位最多 8 字'),
  inboundDate: pastOrTodaySchema,
  stockQty: z.number().int('库存必须是整数').min(0, '库存不能小于 0'),
  warningQty: z.number().int('预警库存必须是整数').min(0, '预警库存不能小于 0'),
  category: z.string().trim().max(50, '分类最多 50 字').default(''),
  supplier: z.string().trim().max(50, '供应商最多 50 字').default(''),
  indications: z.string().trim().max(200, '适应症最多 200 字').default(''),
  costCents: z.number().int('成本必须是整数分').min(0, '成本不能小于 0'),
  priceCents: z.number().int('标价必须是整数分').min(0, '标价不能小于 0')
})

export const purchaseInputSchema = z.object({
  drugId: z.number().int().positive(),
  purchaseDate: pastOrTodaySchema,
  qty: z.number().int('进货数量必须是整数').min(1, '进货数量必须大于 0'),
  unitCostCents: z.number().int('单位成本必须是整数分').min(0, '单位成本不能小于 0')
})

export const prescriptionItemInputSchema = z.object({
  id: z.number().int().positive().optional(),
  drugId: z.number().int().positive(),
  qty: z.number().int('数量必须是整数').min(1, '数量必须大于 0'),
  usage: z.string().trim().max(50, '服用方式最多 50 字').default(''),
  frequency: z.string().trim().max(50, '服用频率最多 50 字').default('')
})

export const prescriptionInputSchema = z.object({
  patientName: z.string().trim().min(1, '请填写患者姓名').max(20, '患者姓名最多 20 字'),
  gender: genderSchema,
  age: z.string().trim().min(1, '请填写年龄').max(10, '年龄最多 10 个字符'),
  diagnosis: z.string().trim().min(1, '请填写临床诊断').max(100, '临床诊断最多 100 字'),
  issueDate: pastOrTodaySchema,
  rp: z.string().trim().max(500, 'Rp 最多 500 字').optional().default(''),
  doctor: z.string().trim().min(1, '请填写医师').max(20, '医师最多 20 字'),
  items: z.array(prescriptionItemInputSchema).min(1, '请至少添加一种药品'),
  injectionFeeCents: z.number().int('注射费必须是整数分').min(0, '注射费不能小于 0'),
  manualDrugAmountCents: z.number().int().min(0).nullable().optional()
})

export const settingsPatchSchema = z
  .object({
    theme: themeSchema.optional(),
    lastDoctor: z.string().max(20).optional(),
    viewModes: z
      .object({
        prescriptions: viewModeSchema,
        pharmacy: viewModeSchema
      })
      .optional(),
    lastExportDir: z.string().optional()
  })
  .partial()

export const listQuerySchema = z.object({
  query: z.string().trim().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20)
})

export const drugListQuerySchema = listQuerySchema.extend({
  filter: z.enum(['all', 'low', 'stopped']).default('all')
})

export const prescriptionListQuerySchema = listQuerySchema.extend({
  dateFrom: dateStringSchema.optional(),
  dateTo: dateStringSchema.optional()
})

export const financeQuerySchema = z.object({
  period: financePeriodSchema,
  anchorDate: dateStringSchema
})

export const financeDetailsQuerySchema = financeQuerySchema.extend({
  key: z.string().min(1),
  label: z.string().optional()
})

export const idSchema = z.number().int().positive()

export type DrugInputParsed = z.infer<typeof drugInputSchema>
export type PrescriptionInputParsed = z.infer<typeof prescriptionInputSchema>
export type PurchaseInputParsed = z.infer<typeof purchaseInputSchema>
