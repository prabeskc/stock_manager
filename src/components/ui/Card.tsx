import type { PropsWithChildren } from 'react'

export function Card({
  className,
  children,
}: PropsWithChildren<{ className?: string }>) {
  return (
    <div className={['rounded-xl bg-white p-4 ring-1 ring-slate-200', className].join(' ')}>
      {children}
    </div>
  )
}

