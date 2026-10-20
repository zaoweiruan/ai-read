import { cn } from '@/lib/utils'

export function Progress({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div
      className={cn(
        'h-2 w-full overflow-hidden rounded-full bg-muted',
        className,
      )}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
       className="h-full bg-primary transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}