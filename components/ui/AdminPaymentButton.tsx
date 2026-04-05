'use client'

import { useTransition } from 'react'
import { updatePaymentStatus } from '@/app/admin/actions'
import { Loader2 } from 'lucide-react'

interface Props {
  bookingId: string
  paymentStatus: string | null
}

export default function AdminPaymentButton({ bookingId, paymentStatus }: Props) {
  const [isPending, startTransition] = useTransition()

  const mark = (status: 'paid' | 'no_show') =>
    startTransition(() => updatePaymentStatus(bookingId, status))

  // Already resolved — show read-only badge
  if (paymentStatus === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        ✓ Pagato
      </span>
    )
  }

  if (paymentStatus === 'no_show') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
        ✕ No-Show
      </span>
    )
  }

  // Pending — show action buttons
  return (
    <div className="flex items-center gap-1.5">
      {isPending ? (
        <Loader2 size={13} className="animate-spin text-rg-dark/30" />
      ) : (
        <>
          <button
            onClick={() => mark('paid')}
            className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors whitespace-nowrap"
          >
            ✓ Pagato
          </button>
          <button
            onClick={() => mark('no_show')}
            className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors whitespace-nowrap"
          >
            ✕ No-Show
          </button>
        </>
      )}
    </div>
  )
}
