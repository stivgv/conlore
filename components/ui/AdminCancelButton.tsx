'use client'

import { useTransition } from 'react'
import { adminCancelBooking } from '@/app/admin/actions'
import { X, Loader2 } from 'lucide-react'

export default function AdminCancelButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => adminCancelBooking(bookingId))}
      disabled={isPending}
      className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-2 py-1 rounded-lg border border-red-200 hover:border-red-300"
      title="Cancel booking"
    >
      {isPending ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
      {isPending ? 'Cancelling…' : 'Cancel'}
    </button>
  )
}
