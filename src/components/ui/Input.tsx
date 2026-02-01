import type { InputHTMLAttributes } from 'react'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={[
        'min-h-11 w-full rounded-md bg-white px-3 text-base ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}
