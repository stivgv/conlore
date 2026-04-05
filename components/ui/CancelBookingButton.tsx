'use client'

import { useTransition } from 'react'
import { memberCancelBooking } from '@/app/dashboard/actions'
import { X, Loader2 } from 'lucide-react'

export default function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition()

  const handleCancel = () => {
    const confirmed = window.confirm(
      'Sei sicuro di voler annullare questa prenotazione? Verifica di essere entro i limiti della politica di cancellazione.'
    )
    if (!confirmed) return
    startTransition(async () => {
      await memberCancelBooking(bookingId)
    })
  }

  return (
    <button
      onClick={handleCancel}
      disabled={isPending}
      className="flex items-center gap-1 text-sm text-gray-400 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
      title="Annulla prenotazione"
    >
      {isPending
        ? <Loader2 size={13} className="animate-spin" />
        : <X size={13} />
      }
      <span>{isPending ? 'Annullamento…' : 'Annulla'}</span>
    </button>
  )
}
