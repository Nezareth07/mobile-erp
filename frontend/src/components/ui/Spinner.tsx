import { cn } from '../../lib/cn'

export type SpinnerSize = 'sm' | 'md' | 'lg'

export interface SpinnerProps {
  size?: SpinnerSize
  label?: string
  className?: string
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
}

export function Spinner({
  size = 'md',
  label = 'Cargando',
  className,
}: SpinnerProps) {
  return (
    <span role="status" className={cn('inline-flex', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'animate-spin rounded-full border-line-strong border-t-primary',
          sizeClasses[size],
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}
