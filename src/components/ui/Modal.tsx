import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

export type ModalProps = {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  footer?: ReactNode
  size?: 'md' | 'lg' | 'xl' | 'full'
}

export function Modal({ open, title, children, onClose, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const widthClass =
    size === 'full'
      ? 'max-w-6xl'
      : size === 'xl'
        ? 'max-w-4xl'
        : size === 'lg'
          ? 'max-w-2xl'
          : 'max-w-lg'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <button
        className="absolute inset-0 bg-slate-950/50"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div
        className={[
          'relative flex w-full flex-col rounded-xl bg-white shadow-xl ring-1 ring-slate-200',
          widthClass,
          'max-h-[calc(100vh-2rem)]',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4">
          <div>
            <div className="text-base font-semibold text-slate-900">{title}</div>
          </div>
          <Button variant="ghost" onClick={onClose} type="button">
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
