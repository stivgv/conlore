'use client'

import { useActionState, useEffect } from 'react'
import { createBooking, type BookingState } from '@/app/dashboard/actions'
import { X, CalendarDays, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

interface BookingModalProps {
  courtId: string
  courtName: string
  onClose: () => void
}

const initialState: BookingState = { status: 'idle' }

export default function BookingModal({ courtId, courtName, onClose }: BookingModalProps) {
  const [state, formAction, isPending] = useActionState(createBooking, initialState)

  useEffect(() => {
    if (state.status === 'success') {
      const timer = setTimeout(onClose, 1200)
      return () => clearTimeout(timer)
    }
  }, [state, onClose])

  const today = new Date().toISOString().split('T')[0]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">Reserve a Court</h2>
            <p className="text-sm text-emerald-600 font-medium mt-0.5">{courtName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">

          {/* Success banner */}
          {state.status === 'success' && (
            <div className="mb-5 flex items-center gap-2.5 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle2 size={16} className="flex-shrink-0" />
              Booking confirmed! Redirecting…
            </div>
          )}

          {/* Error banner */}
          {state.status === 'error' && (
            <div className="mb-5 flex items-center gap-2.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="flex-shrink-0" />
              {state.message}
            </div>
          )}

          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="courtId" value={courtId} />

            {/* Date */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="date" className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <CalendarDays size={12} />
                Date
              </label>
              <input
                id="date"
                name="date"
                type="date"
                min={today}
                required
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Time row */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <Clock size={12} />
                Time Slot
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400 pl-1">Start</span>
                  <input
                    id="startTime"
                    name="startTime"
                    type="time"
                    required
                    className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-400 pl-1">End</span>
                  <input
                    id="endTime"
                    name="endTime"
                    type="time"
                    required
                    className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400 pl-1 mt-0.5">Sessions must be 1–2 hours.</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || state.status === 'success'}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-sm"
              >
                {isPending
                  ? <><Loader2 size={14} className="animate-spin" /> Booking…</>
                  : 'Confirm Booking'
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
