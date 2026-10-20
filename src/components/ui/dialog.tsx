import type { ReactNode } from 'react'

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        role="presentation"
      />
      <div className="relative z-10 w-full max-w-lg rounded-lg border border-border bg-background p-5 shadow-lg">
        {title ? (
          <h2 className="mb-4 text-base font-semibold">{title}</h2>
        ) : null}
        {children}
      </div>
    </div>
  )
}