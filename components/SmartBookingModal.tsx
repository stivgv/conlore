'use client'

import { useActionState, useEffect, useState } from 'react'
import { createBooking, type BookingState } from '@/app/dashboard/actions'
import {
  X, Clock, CalendarDays, CheckCircle2, AlertCircle,
  Loader2, CreditCard, Store, Euro, CalendarPlus, Smartphone,
} from 'lucide-react'

interface SmartBookingModalProps {
  courtId: string
  courtName: string
  preSelectedDate: string
  preSelectedStartTime: string
  onClose: () => void
}

const PRICE_PER_HOUR = 20

const initialState: BookingState = { status: 'idle' }

function calcEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(':').map(Number)
  const total  = h * 60 + m + durationMinutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function formatPrice(euros: number): string {
  return `€${euros.toFixed(2)}`
}

/** Format date+time into Google Calendar / iCal format: YYYYMMDDTHHMMSS */
function toIcalDate(date: string, time: string): string {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`
}

function buildGoogleCalendarUrl(opts: {
  title: string; startDt: string; endDt: string; description: string
}): string {
  const base = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
  return (
    base +
    `&text=${encodeURIComponent(opts.title)}` +
    `&dates=${opts.startDt}/${opts.endDt}` +
    `&details=${encodeURIComponent(opts.description)}` +
    `&location=${encodeURIComponent('Tennis Club')}`
  )
}

function downloadIcs(opts: {
  title: string; startDt: string; endDt: string; description: string; filename: string
}) {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tennis Club//EN',
    'BEGIN:VEVENT',
    `DTSTART:${opts.startDt}`,
    `DTEND:${opts.endDt}`,
    `SUMMARY:${opts.title}`,
    `DESCRIPTION:${opts.description}`,
    'LOCATION:Tennis Club',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${opts.title} in 1 hour`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: opts.filename })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

type PaymentMethod = 'in_app' | 'at_club'

export default function SmartBookingModal({
  courtId,
  courtName,
  preSelectedDate,
  preSelectedStartTime,
  onClose,
}: SmartBookingModalProps) {
  const [state, formAction, isPending] = useActionState(createBooking, initialState)
  const [duration,      setDuration]      = useState<60 | 120>(60)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('in_app')

  const endTime    = calcEndTime(preSelectedStartTime, duration)
  const totalPrice = PRICE_PER_HOUR * (duration / 60)

  const calTitle       = `Tennis — ${courtName}`
  const calDescription = `Prenotazione campo al Tennis Club\nData: ${preSelectedDate}\nOrario: ${preSelectedStartTime} – ${endTime}`
  const calStartDt     = toIcalDate(preSelectedDate, preSelectedStartTime)
  const calEndDt       = toIcalDate(preSelectedDate, endTime)
  const gcalUrl        = buildGoogleCalendarUrl({ title: calTitle, startDt: calStartDt, endDt: calEndDt, description: calDescription })

  const displayDate = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${preSelectedDate}T12:00:00`))

  // Success screen — no auto-close so user can add to calendar
  const isSuccess = state.status === 'success'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rg-dark/8">
          <div>
            <h2 className="text-base font-bold text-rg-dark">
              {isSuccess ? 'Prenotazione Confermata!' : 'Prenota un Campo'}
            </h2>
            <p className="text-sm font-semibold mt-0.5" style={{ color: '#d54527' }}>{courtName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-rg-dark/30 hover:text-rg-dark hover:bg-rg-dark/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5">

          {/* ── ERROR banner ────────────────────────────────────────────────── */}
          {state.status === 'error' && (
            <div className="flex items-center gap-2.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="flex-shrink-0" />
              {state.message}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SUCCESS SCREEN
          ════════════════════════════════════════════════════════════════ */}
          {isSuccess ? (
            <div className="flex flex-col gap-4">

              {/* Confirmed badge */}
              <div className="flex flex-col items-center py-4 gap-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#d54527' + '18' }}>
                  <CheckCircle2 size={28} style={{ color: '#d54527' }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-rg-dark capitalize">{displayDate}</p>
                  <p className="text-xs text-rg-dark/50 mt-0.5">{preSelectedStartTime} – {endTime} · {courtName}</p>
                </div>
              </div>

              {/* Add to calendar section */}
              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-bold text-rg-dark/35 uppercase tracking-widest">
                  Aggiungi al Calendario e Imposta Promemoria
                </p>

                {/* Google Calendar */}
                <a
                  href={gcalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-rg-dark/10 hover:border-rg-dark/25 hover:bg-rg-dark/[0.03] transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white border border-rg-dark/10 flex items-center justify-center flex-shrink-0 shadow-sm">
                    {/* Google Calendar "G" icon */}
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="2" fill="#fff" stroke="#e0e0e0" strokeWidth="1"/>
                      <rect x="3" y="3" width="18" height="5" rx="2" fill="#4285F4"/>
                      <text x="12" y="17" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#4285F4">G</text>
                    </svg>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-rg-dark">Google Calendar</span>
                    <span className="text-xs text-rg-dark/40">Si apre in una nuova scheda · promemoria incluso</span>
                  </div>
                  <CalendarPlus size={14} className="text-rg-dark/25 group-hover:text-rg-dark/50 ml-auto flex-shrink-0 transition-colors" />
                </a>

                {/* Phone / iCal */}
                <button
                  type="button"
                  onClick={() => downloadIcs({
                    title: calTitle,
                    startDt: calStartDt,
                    endDt: calEndDt,
                    description: calDescription,
                    filename: `tennis-${preSelectedDate}-${preSelectedStartTime.replace(':', '')}.ics`,
                  })}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-rg-dark/10 hover:border-rg-dark/25 hover:bg-rg-dark/[0.03] transition-all group w-full text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-white border border-rg-dark/10 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Smartphone size={14} className="text-rg-dark/60" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-rg-dark">Telefono / Calendario Apple</span>
                    <span className="text-xs text-rg-dark/40">Scarica .ics · promemoria 1 ora impostato</span>
                  </div>
                  <CalendarPlus size={14} className="text-rg-dark/25 group-hover:text-rg-dark/50 ml-auto flex-shrink-0 transition-colors" />
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl border border-rg-dark/10 text-rg-dark/50 text-sm font-semibold hover:bg-rg-dark/5 transition-colors"
              >
                Fatto
              </button>
            </div>

          ) : (
          /* ══════════════════════════════════════════════════════════════
              BOOKING FORM
          ══════════════════════════════════════════════════════════════ */
            <>
              {/* Section 1: Details */}
              <div className="flex flex-col gap-2 rounded-xl px-4 py-3.5 border border-rg-dark/8" style={{ backgroundColor: '#31181508' }}>
                <div className="flex items-center gap-2.5 text-sm text-rg-dark/70">
                  <CalendarDays size={13} style={{ color: '#d54527' }} className="flex-shrink-0" />
                  <span className="font-medium capitalize">{displayDate}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-rg-dark/70">
                  <Clock size={13} style={{ color: '#d54527' }} className="flex-shrink-0" />
                  <span className="font-medium">{preSelectedStartTime} – {endTime}</span>
                  <span className="text-rg-dark/35 text-xs">({duration} min)</span>
                </div>
              </div>

              <form action={formAction} className="flex flex-col gap-5">
                <input type="hidden" name="courtId"   value={courtId} />
                <input type="hidden" name="date"       value={preSelectedDate} />
                <input type="hidden" name="startTime"  value={preSelectedStartTime} />
                <input type="hidden" name="endTime"    value={endTime} />

                {/* Section 2: Duration */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-bold text-rg-dark/40 uppercase tracking-widest">Durata</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([60, 120] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDuration(d)}
                        className="py-3 rounded-xl text-sm font-bold border-2 transition-all"
                        style={duration === d
                          ? { backgroundColor: '#d54527', borderColor: '#d54527', color: '#fff' }
                          : { backgroundColor: '#fff', borderColor: '#31181520', color: '#31181599' }}
                      >
                        {d === 60 ? '1 Ora' : '2 Ore'}
                        <span className="block text-[10px] font-semibold mt-0.5" style={{ opacity: 0.65 }}>
                          {formatPrice(PRICE_PER_HOUR * (d / 60))}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section 3: Payment */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-bold text-rg-dark/40 uppercase tracking-widest">Pagamento</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: 'in_app' as const, icon: CreditCard, label: 'Paga Ora', sub: 'Sicuro · Immediato' },
                      { id: 'at_club' as const, icon: Store,      label: 'Paga al Circolo', sub: 'Contanti · Carta' },
                    ]).map(({ id, icon: Icon, label, sub }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPaymentMethod(id)}
                        className="flex flex-col items-center gap-1.5 py-3.5 px-3 rounded-xl border-2 transition-all"
                        style={paymentMethod === id
                          ? { backgroundColor: '#311815', borderColor: '#311815', color: '#fff' }
                          : { backgroundColor: '#fff', borderColor: '#31181520', color: '#31181599' }}
                      >
                        <Icon size={16} style={paymentMethod === id ? { color: '#d54527' } : { opacity: 0.35 }} />
                        <span className="text-xs font-bold leading-tight">{label}</span>
                        <span className="text-[10px] leading-tight" style={{ opacity: 0.5 }}>{sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section 4: Summary */}
                <div className="flex items-center justify-between rounded-xl px-5 py-4" style={{ backgroundColor: '#311815' }}>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Totale</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-white">{formatPrice(totalPrice)}</span>
                      <span className="text-xs text-white/40">{duration === 60 ? '1 ora' : '2 ore'}</span>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#d5452726' }}>
                    <Euro size={18} style={{ color: '#d54527' }} />
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
                    type="submit"
                    disabled={isPending}
                    className="flex-1 flex items-center justify-center gap-2 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#d54527' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#be3b1e')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#d54527')}
                  >
                    {isPending ? (
                      <><Loader2 size={14} className="animate-spin" />Prenotazione…</>
                    ) : paymentMethod === 'in_app' ? (
                      `Conferma e Paga ${formatPrice(totalPrice)}`
                    ) : (
                      'Conferma Prenotazione'
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
