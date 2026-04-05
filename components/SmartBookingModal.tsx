'use client'

import { useActionState, useState } from 'react'
import { createBooking, type BookingState } from '@/app/dashboard/actions'
import {
  X, Clock, CalendarDays, CheckCircle2, AlertCircle,
  Loader2, Euro, CalendarPlus, Smartphone,
} from 'lucide-react'
import { PRICING } from '@/lib/config/pricing'

interface SmartBookingModalProps {
  courtId: string
  courtName: string
  preSelectedDate: string
  preSelectedStartTime: string
  onClose: () => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(':').map(Number)
  const total  = h * 60 + m + durationMinutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Winter rule: lights needed when session ends after 18:00 */
function needsLights(endTime: string): boolean {
  return endTime > '18:00'
}

function formatPrice(euros: number): string {
  return `€${euros.toFixed(2)}`
}

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

const initialState: BookingState = { status: 'idle' }

export default function SmartBookingModal({
  courtId,
  courtName,
  preSelectedDate,
  preSelectedStartTime,
  onClose,
}: SmartBookingModalProps) {
  const [state, formAction, isPending] = useActionState(createBooking, initialState)
  const [duration,     setDuration]     = useState<60 | 120>(60)
  const [wantsBalls,   setWantsBalls]   = useState(false)
  const [playersCount, setPlayersCount] = useState(1)

  // ── Pricing math ────────────────────────────────────────────────────────────
  const endTime       = calcEndTime(preSelectedStartTime, duration)
  const courtCost     = PRICING.PER_HOUR * (duration / 60)
  const lightsApplied = needsLights(endTime)
  const lightsCost    = lightsApplied ? PRICING.LIGHT_FEE : 0
  const ballsCost     = wantsBalls ? PRICING.BALLS_FEE : 0
  const totalPrice    = courtCost + lightsCost + ballsCost
  const pricePerPerson = totalPrice / playersCount

  // ── Calendar helpers ────────────────────────────────────────────────────────
  const calTitle       = `Tennis — ${courtName}`
  const calDescription = `Prenotazione campo al Tennis Club\nData: ${preSelectedDate}\nOrario: ${preSelectedStartTime} – ${endTime}`
  const calStartDt     = toIcalDate(preSelectedDate, preSelectedStartTime)
  const calEndDt       = toIcalDate(preSelectedDate, endTime)
  const gcalUrl        = buildGoogleCalendarUrl({ title: calTitle, startDt: calStartDt, endDt: calEndDt, description: calDescription })

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

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rg-dark/8 sticky top-0 bg-white z-10">
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

          {/* ── ERROR banner ──────────────────────────────────────────────────── */}
          {state.status === 'error' && (
            <div className="flex items-center gap-2.5 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="flex-shrink-0" />
              {state.message}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              SUCCESS SCREEN
          ══════════════════════════════════════════════════════════════════ */}
          {isSuccess ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center py-4 gap-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#d5452718' }}>
                  <CheckCircle2 size={28} style={{ color: '#d54527' }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-rg-dark capitalize">{displayDate}</p>
                  <p className="text-xs text-rg-dark/50 mt-0.5">{preSelectedStartTime} – {endTime} · {courtName}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-bold text-rg-dark/35 uppercase tracking-widest">
                  Aggiungi al Calendario e Imposta Promemoria
                </p>
                <a
                  href={gcalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-rg-dark/10 hover:border-rg-dark/25 hover:bg-rg-dark/[0.03] transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white border border-rg-dark/10 flex items-center justify-center flex-shrink-0 shadow-sm">
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
                <button
                  type="button"
                  onClick={() => downloadIcs({
                    title: calTitle, startDt: calStartDt, endDt: calEndDt,
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
          /* ══════════════════════════════════════════════════════════════════
              BOOKING FORM
          ══════════════════════════════════════════════════════════════════ */
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
                <input type="hidden" name="courtId"    value={courtId} />
                <input type="hidden" name="date"        value={preSelectedDate} />
                <input type="hidden" name="startTime"   value={preSelectedStartTime} />
                <input type="hidden" name="endTime"     value={endTime} />

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
                          {formatPrice(PRICING.PER_HOUR * (d / 60))}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section 3: Extra add-ons */}
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-bold text-rg-dark/40 uppercase tracking-widest">Extra</p>

                  {/* Auto-lights notice (shown only when applicable) */}
                  {lightsApplied && (
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-rg-dark/8" style={{ backgroundColor: '#31181506' }}>
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm leading-none">💡</span>
                        <div>
                          <p className="text-xs font-semibold text-rg-dark/70">Illuminazione automatica</p>
                          <p className="text-[10px] text-rg-dark/40 mt-0.5">Fascia serale — applicata dopo le 18:00</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold flex-shrink-0" style={{ color: '#d54527' }}>+{formatPrice(PRICING.LIGHT_FEE)}</span>
                    </div>
                  )}

                  {/* Balls toggle */}
                  <button
                    type="button"
                    onClick={() => setWantsBalls(b => !b)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all"
                    style={wantsBalls
                      ? { borderColor: '#d54527', backgroundColor: '#d5452710' }
                      : { borderColor: '#31181515', backgroundColor: '#fff' }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm leading-none">🎾</span>
                      <span className="text-xs font-semibold text-rg-dark/70">Aggiungi Tubo di Palline</span>
                    </div>
                    <span
                      className="text-xs font-bold flex-shrink-0 transition-colors"
                      style={{ color: wantsBalls ? '#d54527' : '#31181540' }}
                    >
                      +{formatPrice(PRICING.BALLS_FEE)}
                    </span>
                  </button>
                </div>

                {/* Section 5: Summary box */}
                <div className="rounded-xl px-5 py-4 flex flex-col gap-3" style={{ backgroundColor: '#311815' }}>

                  {/* Line-item breakdown */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px] text-white/40">
                      <span>Campo · {duration === 60 ? '1 ora' : '2 ore'}</span>
                      <span>{formatPrice(courtCost)}</span>
                    </div>
                    {lightsApplied && (
                      <div className="flex items-center justify-between text-[11px] text-white/40">
                        <span>💡 Illuminazione</span>
                        <span>{formatPrice(PRICING.LIGHT_FEE)}</span>
                      </div>
                    )}
                    {wantsBalls && (
                      <div className="flex items-center justify-between text-[11px] text-white/40">
                        <span>🎾 Palline</span>
                        <span>{formatPrice(PRICING.BALLS_FEE)}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/10" />

                  {/* Total row + players split */}
                  <div className="flex items-end justify-between gap-3">

                    {/* Left: totale + quota a persona */}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Totale</span>
                      <span className="text-2xl font-black text-white leading-none">{formatPrice(totalPrice)}</span>
                      {playersCount > 1 && (
                        <>
                          <p className="text-xs font-semibold mt-1" style={{ color: '#d54527' }}>
                            {formatPrice(pricePerPerson)} / persona
                          </p>
                          <p className="text-[10px] text-white/25 mt-0.5 leading-snug max-w-[160px]">
                            Nota: Il titolare della prenotazione è responsabile del saldo totale in segreteria.
                          </p>
                        </>
                      )}
                    </div>

                    {/* Right: players selector */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="text-[10px] text-white/35 font-medium tracking-wide">Dividi tra</span>
                      <div className="flex gap-1">
                        {([1, 2, 3, 4] as const).map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setPlayersCount(n)}
                            className="w-7 h-7 rounded-lg text-xs font-bold transition-all"
                            style={playersCount === n
                              ? { backgroundColor: '#d54527', color: '#fff' }
                              : { backgroundColor: '#ffffff15', color: '#ffffff50' }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cancellation policy */}
                <div className="rounded-xl px-4 py-3 text-[11px] text-rg-dark/55 leading-relaxed" style={{ backgroundColor: '#31181510' }}>
                  <span className="font-bold text-rg-dark/70">Politica di Cancellazione: </span>
                  Gratuita fino a 24h prima dell&apos;orario di inizio. Le mancate presentazioni (No-Show) comporteranno l&apos;addebito dell&apos;intera quota.
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
                    ) : (
                      'Prenota e Paga al Circolo'
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
