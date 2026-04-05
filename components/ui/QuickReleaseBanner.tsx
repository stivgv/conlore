'use client'

import { useState, useTransition } from 'react'
import { teacherCancelBooking } from '@/app/dashboard/actions'
import { Zap, Loader2, X } from 'lucide-react'

interface ActiveLesson {
  id: string
  courtName: string
  studentName: string | null
  startTime: string
  endTime: string
}

interface QuickReleaseBannerProps {
  activeLesson: ActiveLesson | null
}

export default function QuickReleaseBanner({ activeLesson }: QuickReleaseBannerProps) {
  const [isPending, startTransition] = useTransition()
  const [confirmStep, setConfirmStep] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (!activeLesson || dismissed) return null

  const pad = (n: number) => String(n).padStart(2, '0')
  const s = new Date(activeLesson.startTime)
  const e = new Date(activeLesson.endTime)
  const timeLabel = `${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())} – ${pad(e.getUTCHours())}:${pad(e.getUTCMinutes())}`

  function handleRelease() {
    startTransition(async () => {
      await teacherCancelBooking(activeLesson!.id)
    })
  }

  return (
    <div className="rounded-2xl border-2 border-amber-300/60 bg-amber-50 px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
          <Zap size={16} className="text-amber-600" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-rg-dark">Lezione in corso — {activeLesson.courtName}</p>
          <p className="text-xs text-rg-dark/55 mt-0.5">
            {activeLesson.studentName ? `Allievo: ${activeLesson.studentName} · ` : ''}{timeLabel}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {confirmStep ? (
          <>
            <button
              type="button"
              onClick={() => setConfirmStep(false)}
              className="text-xs px-3 py-1.5 rounded-lg border border-rg-dark/15 text-rg-dark/50 hover:bg-rg-dark/5 transition-colors font-medium"
            >
              No
            </button>
            <button
              type="button"
              onClick={handleRelease}
              disabled={isPending}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {isPending ? <Loader2 size={10} className="animate-spin" /> : null}
              Conferma
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirmStep(true)}
              className="text-xs px-3 py-2 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors flex items-center gap-1.5"
            >
              <Zap size={12} />
              Rilascio Rapido
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-rg-dark/30 hover:text-rg-dark hover:bg-rg-dark/5 transition-colors"
              aria-label="Chiudi"
            >
              <X size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
