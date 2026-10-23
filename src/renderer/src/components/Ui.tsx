import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes
} from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, LayoutGrid, List, Search, X } from 'lucide-react'
import { formatCents } from '@shared/money'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'text-danger'
export type ButtonSize = 'md' | 'sm' | 'xs'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps): React.JSX.Element {
  const variantClass =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'danger'
        ? 'btn-danger'
        : variant === 'ghost'
          ? 'btn-ghost'
          : variant === 'text-danger'
            ? 'btn-ghost btn-text-danger'
            : 'btn-secondary'
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'xs' ? 'btn-xs' : ''
  return (
    <button
      type="button"
      className={`btn ${variantClass} ${sizeClass} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="spinner" aria-hidden="true" /> : icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  danger?: boolean
  children: ReactNode
}

export function IconButton({
  label,
  danger = false,
  children,
  className = '',
  ...rest
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className={`icon-btn ${danger ? 'danger' : ''} ${className}`.trim()}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  )
}

interface FieldProps {
  label?: string
  required?: boolean
  error?: string | null
  hint?: string
  children: ReactNode
  className?: string
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
  className = ''
}: FieldProps): React.JSX.Element {
  return (
    <div className={`field ${className}`.trim()}>
      {label ? (
        <label className="field-label">
          {label}
          {required ? <span className="required">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  )
}

export function TextInput({
  invalid,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }): React.JSX.Element {
  return <input className={`input ${invalid ? 'invalid' : ''} ${className}`.trim()} {...rest} />
}

export function TextArea({
  invalid,
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }): React.JSX.Element {
  return <textarea className={`textarea ${invalid ? 'invalid' : ''} ${className}`.trim()} {...rest} />
}

export function Select({
  invalid,
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }): React.JSX.Element {
  return (
    <select className={`select ${invalid ? 'invalid' : ''} ${className}`.trim()} {...rest}>
      {children}
    </select>
  )
}

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  testId?: string
}

export function SearchInput({
  value,
  onChange,
  placeholder = '搜索',
  testId
}: SearchInputProps): React.JSX.Element {
  return (
    <div className="search">
      <Search size={16} />
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button type="button" className="search-clear" aria-label="清除搜索" onClick={() => onChange('')}>
          <X size={14} />
        </button>
      ) : null}
    </div>
  )
}

export function Tag({
  children,
  tone = 'default'
}: {
  children: ReactNode
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'muted'
}): React.JSX.Element {
  return <span className={`tag ${tone === 'default' ? '' : tone}`.trim()}>{children}</span>
}

export function Money({ cents, className = '' }: { cents: number; className?: string }): React.JSX.Element {
  return <span className={`money ${className}`.trim()}>{formatCents(cents)}</span>
}

export function StatCard({
  label,
  value,
  tone,
  testId
}: {
  label: string
  value: ReactNode
  tone?: 'positive' | 'negative'
  testId?: string
}): React.JSX.Element {
  return (
    <div className="stat-card" data-testid={testId}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone ?? ''}`.trim()}>{value}</div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
  icon
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
}): React.JSX.Element {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon ?? <AlertTriangle size={22} />}</div>
      <div className="empty-title">{title}</div>
      {description ? <div className="empty-desc">{description}</div> : null}
      {action}
    </div>
  )
}

export function Pagination({
  total,
  page,
  pageSize,
  onChange
}: {
  total: number
  page: number
  pageSize: number
  onChange: (page: number) => void
}): React.JSX.Element | null {
  if (total <= pageSize) return null
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="pagination">
      <span>
        共 {total} 条 · 第 {page} / {pages} 页
      </span>
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="上一页">
        <ChevronLeft size={16} />
      </button>
      <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="下一页">
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

export function ViewToggle({
  value,
  onChange
}: {
  value: 'card' | 'list'
  onChange: (value: 'card' | 'list') => void
}): React.JSX.Element {
  return (
    <div className="view-toggle" role="group" aria-label="视图切换">
      <button
        type="button"
        className={value === 'card' ? 'active' : ''}
        onClick={() => onChange('card')}
        data-testid="view-card"
      >
        <LayoutGrid size={14} /> 卡片
      </button>
      <button
        type="button"
        className={value === 'list' ? 'active' : ''}
        onClick={() => onChange('list')}
        data-testid="view-list"
      >
        <List size={14} /> 列表
      </button>
    </div>
  )
}

interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  small?: boolean
  testId?: string
}

export function Dialog({
  open,
  title,
  onClose,
  children,
  footer,
  small,
  testId
}: DialogProps): React.JSX.Element | null {
  if (!open) return null
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className={`dialog ${small ? 'small' : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-head">
          <h2 className="dialog-title">{title}</h2>
          <IconButton label="关闭" className="dialog-close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="dialog-body">{children}</div>
        {footer ? <div className="dialog-foot">{footer}</div> : null}
      </div>
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmText?: string
  cancelText?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
  testId?: string
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
  testId
}: ConfirmDialogProps): React.JSX.Element | null {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      small
      testId={testId}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            data-testid={testId ? `${testId}-confirm` : undefined}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="muted">{message}</div>
    </Dialog>
  )
}

export function Drawer({
  open,
  title,
  onClose,
  children,
  wide,
  testId
}: {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  testId?: string
}): React.JSX.Element | null {
  if (!open) return null
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className={`drawer ${wide ? 'wide' : ''}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <h2 className="drawer-title">{title}</h2>
          <IconButton label="关闭" className="dialog-close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  )
}

export function Banner({
  children,
  tone = 'default',
  action
}: {
  children: ReactNode
  tone?: 'default' | 'warning'
  action?: ReactNode
}): React.JSX.Element {
  return (
    <div className={`banner ${tone === 'warning' ? 'warning' : ''}`.trim()}>
      <AlertTriangle size={16} />
      <span>{children}</span>
      {action ? <span className="banner-action">{action}</span> : null}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}): React.JSX.Element {
  return (
    <div className="page-head">
      <div className="title-block">
        <h1 className="page-title">{title}</h1>
        {subtitle ? <span className="page-subtitle">{subtitle}</span> : null}
      </div>
      {actions ? <div className="page-head-actions">{actions}</div> : null}
    </div>
  )
}
