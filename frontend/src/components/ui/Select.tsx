import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...rest }, ref) => (
    <select
      ref={ref}
      aria-invalid={error ? true : undefined}
      className={cn(
        'block w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted',
        error ? 'border-danger' : 'border-line',
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  ),
)

Select.displayName = 'Select'
