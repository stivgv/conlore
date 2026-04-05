'use client'

import { useActionState, useState } from 'react'
import { createTeacherBooking, type BookingState } from '@/app/dashboard/actions'
import { X, Clock, CalendarDays, CheckCircle2, AlertCircle, Loader2, User } from 'lucide-react'

interface TeacherBookingModalProps {
  courtId: string
  courtName: string
  preSelectedDate: string
  preSelectedStartTime: string
  onClose: () => void
}

// endTime = startTime + 60 min
function calcEndTime(startTime: string): string {
  const [h, m] = startTime.split(':').map(Number)
  const total = h * 60 + m + 60
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const initialState: BookingState = { status: 'idle' }

export default function TeacherBookingModal({
  courtId,
  courtName,
  preSelectedDate,
  preSelectedStartTime,
  onClose,
}: TeacherBookingModalProps) {
  const [state, formAction, isPending] = useActionState(createTeacherBooking, initialState)
  const [studentName, setStudentName] = useState('')
  const [step, setStep] = useState<'form' | 'confirm'>('form')

  const endTime = calcEndTime(preSelectedStartTime)
  const displayDate = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${preSelectedDate}T12:00:00`))

  const isSuccess = state.status === 'success'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[95dvh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rg-dark/8 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-bold text-rg-dark">
              {isSuccess ? 'Lezione Registrata!' : '🎾 Nuova Lezione'}
            </h2>
            <p className="text-sm font-semibold mt-0.5 text-rg-clay">{courtName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-rg-dark/30 hover:text-rg-dark hover:bg-rg-dark/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">

          {/* Error banner */}
          {state.status === 'error' && (
            <div className="flex items-center gap-2.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="flex-shrink-0" />
              {state.message}
            </div>
          )}

          {/* SUCCESS */}
          {isSuccess ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center py-4 gap-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center bg-green-50">
                  <CheckCircle2 size={28} className="text-green-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-rg-dark capitalize">{displayDate}</p>
                  <p className="text-xs text-rg-dark/50 mt-0.5">{preSelectedStartTime} – {endTime} · {courtName}</p>
                  <p className="text-xs text-rg-dark/50 mt-0.5">Allievo: <span className="font-semibold text-rg-dark">{studentName}</span></p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl border border-rg-dark/10 text-rg-dark/50 text-sm font-semibold hover:bg-rg-dark/5 transition-colors"
              >
                Fatto
              </button>
            </div>

          ) : step === 'form' ? (
            /* STEP 1: Form */
            <>
              {/* Session summary */}
              <div className="flex flex-col gap-2 rounded-xl px-4 py-3.5 border border-rg-dark/8 bg-rg-dark/[0.03]">
                <div className="flex items-center gap-2.5 text-sm text-rg-dark/70">
                  <CalendarDays size={13} className="text-rg-clay flex-shrink-0" />
                  <span className="font-medium capitalize">{displayDate}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-rg-dark/70">
                  <Clock size={13} className="text-rg-clay flex-shrink-0" />
                  <span className="font-medium">{preSelectedStartTime} – {endTime}</span>
                  <span className="text-rg-dark/35 text-xs">(60 min)</span>
                </div>
              </div>

              {/* Student name input */}
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-rg-dark/40 uppercase tracking-widest">
                  Nome Allievo
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-rg-dark/30" />
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Es. Marco Rossi"
                    className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-rg-dark/12 text-sm text-rg-dark placeholder:text-rg-dark/30 outline-none focus:border-rg-clay transition-colors"
                    autoFocus
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 border border-rg-dark/12 text-rg-dark/50 font-semibold py-3 rounded-xl text-sm hover:bg-rg-dark/5 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  disabled={!studentName.trim()}
                  onClick={() => setStep('confirm')}
                  className="flex-1 font-bold py-3 rounded-xl text-sm text-white transition-colors bg-rg-clay disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rg-dark"
                >
                  Avanti →
                </button>
              </div>
            </>

          ) : (
            /* STEP 2: Confirm */
            <>
              <p className="text-xs text-rg-dark/50 text-center">Verifica i dettagli prima di confermare</p>

              {/* Summary card */}
              <div className="rounded-xl border-2 border-rg-dark/10 overflow-hidden">
                <div className="px-5 py-3 bg-rg-dark/[0.03] flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <User size={14} className="text-rg-clay flex-shrink-0" />
                    <span className="text-rg-dark/50">Allievo:</span>
                    <span className="font-bold text-rg-dark">{studentName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock size={14} className="text-rg-clay flex-shrink-0" />
                    <span className="text-rg-dark/50">Orario:</span>
                    <span className="font-bold text-rg-dark">{preSelectedStartTime} – {endTime}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarDays size={14} className="text-rg-clay flex-shrink-0" />
                    <span className="text-rg-dark/50">Data:</span>
                    <span className="font-bold text-rg-dark capitalize">{displayDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-rg-clay flex-shrink-0">🏟</span>
                    <span className="text-rg-dark/50">Campo:</span>
                    <span className="font-bold text-rg-dark">{courtName}</span>
                  </div>
                </div>
              </div>

              <form action={formAction} className="flex flex-col gap-3">
                <input type="hidden" name="courtId"     value={courtId} />
                <input type="hidden" name="date"         value={preSelectedDate} />
                <input type="hidden" name="startTime"    value={preSelectedStartTime} />
                <input type="hidden" name="endTime"      value={endTime} />
                <input type="hidden" name="studentName"  value={studentName} />

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setStep('form')}
                    className="flex-1 border border-rg-dark/12 text-rg-dark/50 font-semibold py-3 rounded-xl text-sm hover:bg-rg-dark/5 transition-colors"
                  >
                    ← Modifica
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl text-sm bg-rg-clay hover:bg-rg-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPending ? (
                      <><Loader2 size={14} className="animate-spin" />Salvataggio…</>
                    ) : (
                      'Conferma Lezione'
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
