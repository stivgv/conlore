'use client'

import { useState, useTransition } from 'react'
import { teacherCancelBooking } from '@/app/dashboard/actions'
import { Loader2, Trash2 } from 'lucide-react'

interface TeacherCancelButtonProps {
  bookingId: string
}

export default function TeacherCancelButton({ bookingId }: TeacherCancelButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [confirmStep, setConfirmStep] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFirstClick() {
    setConfirmStep(true)
    setError(null)
  }

  function handleCancel() {
    setConfirmStep(false)
    setError(null)
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await teacherCancelBooking(bookingId)
      if (result.status === 'error') {
        setError(result.message)
        setConfirmStep(false)
      }
    })
  }

  if (confirmStep) {
    return (
      <div className="flex flex-col gap-1.5 items-end">
        <p className="text-xs text-rg-dark/60 font-medium">Annullare la lezione?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="text-xs px-3 py-1.5 rounded-lg border border-rg-dark/15 text-rg-dark/50 hover:bg-rg-dark/5 transition-colors font-medium"
          >
            No
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {isPending ? <Loader2 size={10} className="animate-spin" /> : null}
            Sì, annulla
          </button>
        </div>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleFirstClick}
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-rg-dark/12 text-rg-dark/40 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors font-medium"
    >
      <Trash2 size={11} />
      Annulla lezione
    </button>
  )
}
