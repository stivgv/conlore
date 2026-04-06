'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Trash2, UserRound } from 'lucide-react'
import { type ScheduleCourt, type ScheduleBooking } from '@/components/GlobalScheduleGrid'
import TeacherBookingModal from '@/components/TeacherBookingModal'
import { teacherCancelBooking } from '@/app/dashboard/actions'

// ─── Types ─────────────────────────────────────────────────────────────────────

type WeekBooking = ScheduleBooking & { user_id: string }

interface TeacherWeeklyCalendarProps {
  courts:       ScheduleCourt[]
  bookings:     WeekBooking[]
  date:         string    // YYYY-MM-DD (giorno selezionato)
  today:        string    // YYYY-MM-DD
  teacherId:    string
  teacherName:  string
  teacherColor: string    // hex es. '#6366f1'
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const HOUR_SLOTS = Array.from({ length: 15 }, (_, i) =>
  `${String(8 + i).padStart(2, '0')}:00`
)

// ─── Helpers ───────────────────────────────────────────────────────────────────

function offsetDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d + days).toLocaleDateString('en-CA')
}

function isApplicable(court: ScheduleCourt, slot: string): boolean {
  const [sh, sm] = slot.split(':').map(Number)
  const [oh, om] = court.open_time.split(':').map(Number)
  const [ch, cm] = court.close_time.split(':').map(Number)
  return (sh * 60 + sm) >= (oh * 60 + om) && (sh * 60 + sm) < (ch * 60 + cm)
}

/** Trova la booking che occupa questo campo+giorno+slot (finestra 1h, UTC) */
function getBooking(bookings: WeekBooking[], courtId: string, date: string, slot: string): WeekBooking | null {
  const start = new Date(`${date}T${slot}:00Z`)
  const end   = new Date(start.getTime() + 3_600_000)
  return bookings.find(b =>
    b.court_id === courtId &&
    new Date(b.start_time) < end &&
    new Date(b.end_time)   > start
  ) ?? null
}

function isPast(date: string, slot: string): boolean {
  return new Date(`${date}T${slot}:00Z`).getTime() + 3_600_000 <= Date.now()
}

function fmtHM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** Genera 7 pill-scorciatoie a partire da oggi */
function getShortcutDays(today: string): Array<{ date: string; label: string; sublabel: string }> {
  const labels: Record<number, string> = { 0: 'Oggi', 1: 'Domani', 2: 'Dopo' }
  return Array.from({ length: 7 }, (_, i) => {
    const d  = offsetDate(today, i)
    const dt = new Date(`${d}T12:00:00`)
    const wd = dt.toLocaleDateString('it-IT', { weekday: 'short' })
    return {
      date:     d,
      label:    labels[i] ?? (wd.charAt(0).toUpperCase() + wd.slice(1)),
      sublabel: `${dt.getDate()}/${dt.getMonth() + 1}`,
    }
  })
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function TeacherWeeklyCalendar({
  courts, bookings, date, today, teacherId, teacherName, teacherColor,
}: TeacherWeeklyCalendarProps) {
  const router        = useRouter()
  const dateInputRef  = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()

  const [modal, setModal] = useState<{
    courtId: string; courtName: string; startTime: string
  } | null>(null)

  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)
  const [cancelError,   setCancelError]   = useState<string | null>(null)

  const prevDay   = offsetDate(date, -1)
  const nextDay   = offsetDate(date, +1)
  const shortcuts = getShortcutDays(today)

  const gridDateLabel = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
  }).format(new Date(`${date}T12:00:00`))

  // Mie lezioni del giorno (per la lista in basso)
  const myLessons = bookings
    .filter(b => b.user_id === teacherId)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  // Primo slot libero (per scroll)
  let firstAvailableSlotId: string | null = null
  outer: for (const slot of HOUR_SLOTS) {
    for (const court of courts) {
      if (!isApplicable(court, slot)) continue
      if (isPast(date, slot)) continue
      if (getBooking(bookings, court.id, date, slot) !== null) continue
      firstAvailableSlotId = `tslot-${court.id}-${slot}`
      break outer
    }
  }

  function scrollToFirstAvailable() {
    if (!firstAvailableSlotId) return
    document.getElementById(firstAvailableSlotId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function handleCancel(bookingId: string) {
    setCancelError(null)
    startTransition(async () => {
      const result = await teacherCancelBooking(bookingId)
      if (result.status === 'error') {
        setCancelError(result.message)
      } else {
        setCancelConfirm(null)
        router.refresh()
      }
    })
  }

  const tableMinWidth = `${52 + courts.length * 140}px`

  return (
    <div className="flex flex-col gap-5 max-w-[70%] mx-auto px-2">

      {/* ── Titolo ─────────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-rg-dark tracking-tight">Le Mie Lezioni</h2>
        <p className="text-sm text-rg-dark/45 mt-0.5 capitalize">{gridDateLabel}</p>
      </div>

      {/* ── Navigazione giorno ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">

        <Link
          href={`/dashboard/teacher?date=${prevDay}`}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-rg-dark/15 text-rg-dark/50 font-bold text-base hover:border-rg-clay hover:text-rg-clay hover:bg-rg-clay/5 transition-all duration-150 flex-shrink-0"
          aria-label="Giorno precedente"
        >
          ←
        </Link>

        {/* Data + date picker */}
        <button
          type="button"
          onClick={() => dateInputRef.current?.showPicker()}
          className="flex-1 flex items-center justify-center gap-2 font-bold text-rg-dark text-base capitalize hover:text-rg-clay transition-colors duration-150 group"
        >
          <span>{gridDateLabel}</span>
          <CalendarDays size={15} className="text-rg-dark/30 group-hover:text-rg-clay transition-colors" />
        </button>
        <input
          ref={dateInputRef}
          type="date"
          value={date}
          onChange={(e) => { if (e.target.value) router.push(`/dashboard/teacher?date=${e.target.value}`) }}
          className="sr-only"
          aria-hidden="true"
        />

        <Link
          href={`/dashboard/teacher?date=${nextDay}`}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-rg-dark/15 text-rg-dark/50 font-bold text-base hover:border-rg-clay hover:text-rg-clay hover:bg-rg-clay/5 transition-all duration-150 flex-shrink-0"
          aria-label="Giorno successivo"
        >
          →
        </Link>

        {date !== today && (
          <Link
            href="/dashboard/teacher"
            className="px-4 py-1.5 rounded-full text-sm font-semibold flex-shrink-0 bg-rg-clay text-white hover:bg-rg-dark transition-colors duration-150"
          >
            Oggi
          </Link>
        )}

        {firstAvailableSlotId && (
          <button
            type="button"
            onClick={scrollToFirstAvailable}
            className="px-4 py-1.5 rounded-full text-sm font-semibold flex-shrink-0 border-2 border-rg-clay/40 text-rg-clay bg-white hover:bg-rg-clay/8 transition-colors duration-150"
          >
            ↓ Primo libero
          </button>
        )}
      </div>

      {/* ── Scorciatoie data ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mb-1">
        {shortcuts.map(({ date: d, label, sublabel }) => {
          const isActive = d === date
          return (
            <Link
              key={d}
              href={`/dashboard/teacher?date=${d}`}
              className={[
                'flex flex-col items-center px-3 py-2 rounded-xl text-center flex-shrink-0 transition-all duration-150 min-w-[52px]',
                isActive
                  ? 'bg-rg-clay text-white shadow-sm'
                  : 'bg-rg-dark/5 text-rg-dark/60 hover:bg-rg-clay/10 hover:text-rg-clay',
              ].join(' ')}
            >
              <span className={`text-[11px] font-bold leading-none ${isActive ? 'text-white' : ''}`}>{label}</span>
              <span className={`text-[10px] mt-0.5 leading-none ${isActive ? 'text-white/75' : 'text-rg-dark/40'}`}>{sublabel}</span>
            </Link>
          )
        })}
      </div>

      {/* ── Griglia campi ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-rg-dark/12 shadow-sm w-full overflow-x-auto pb-2">
        <table className="w-full border-collapse" style={{ minWidth: tableMinWidth }}>
          <thead>
            <tr style={{ background: '#311815' }}>
              <th className="w-[52px] px-3 py-3 text-left text-[10px] font-bold text-white/40 uppercase tracking-widest border-r border-white/8">
                ORA
              </th>
              {courts.map(court => (
                <th key={court.id} className="px-3 py-3 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-white/8 last:border-r-0">
                  {court.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HOUR_SLOTS.map((slot, rowIdx) => {
              const bandEven = rowIdx % 2 === 0
              return (
                <tr key={slot} className={`border-t border-rg-dark/[0.06] ${bandEven ? 'bg-white' : 'bg-rg-dark/[0.015]'}`}>

                  {/* Etichetta ora */}
                  <td className="px-3 py-2 w-[52px] border-r border-rg-dark/8 align-top">
                    <span className="text-xs font-bold text-rg-dark/60">{slot}</span>
                  </td>

                  {/* Celle per campo */}
                  {courts.map(court => {

                    // 1. Fuori orario apertura campo
                    if (!isApplicable(court, slot)) {
                      return (
                        <td key={court.id} className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0 bg-rg-dark/[0.025]">
                          <div className="h-[48px] rounded-xl flex items-center justify-center">
                            <span className="text-xs text-rg-dark/20 select-none font-medium">—</span>
                          </div>
                        </td>
                      )
                    }

                    // 2. Passato
                    if (isPast(date, slot)) {
                      return (
                        <td key={court.id} className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0">
                          <div className="h-[48px] rounded-xl bg-rg-dark/[0.03] flex items-center justify-center">
                            <span className="text-xs text-rg-dark/25 font-medium select-none">Passato</span>
                          </div>
                        </td>
                      )
                    }

                    const booking = getBooking(bookings, court.id, date, slot)

                    // 3. Mia lezione (evidenziata con il colore del maestro)
                    if (booking && booking.user_id === teacherId) {
                      const color   = teacherColor
                      const isStart = new Date(booking.start_time).getUTCHours() === parseInt(slot)
                      return (
                        <td key={court.id} className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0">
                          <div
                            className="h-[48px] rounded-xl border border-l-[3px] flex flex-col justify-center px-2.5 gap-0.5"
                            style={{ borderColor: `${color}50`, borderLeftColor: color, backgroundColor: `${color}18` }}
                          >
                            {isStart ? (
                              <>
                                <span className="text-[11px] font-bold leading-none truncate text-rg-dark">
                                  🎾 {booking.student_name ?? '—'}
                                </span>
                                <span className="text-[10px] leading-none" style={{ color: `${color}99` }}>
                                  {fmtHM(booking.start_time)}–{fmtHM(booking.end_time)}
                                </span>
                              </>
                            ) : (
                              <span className="text-[10px] font-semibold" style={{ color: `${color}80` }}>↑</span>
                            )}
                          </div>
                        </td>
                      )
                    }

                    // 4. Lezione di un altro maestro
                    if (booking && booking.booking_type === 'teacher') {
                      const color   = booking.teacher_color ?? '#6366f1'
                      const isStart = new Date(booking.start_time).getUTCHours() === parseInt(slot)
                      return (
                        <td key={court.id} className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0">
                          <div
                            className="h-[48px] rounded-xl border border-l-[3px] flex flex-col justify-center px-2.5 gap-0.5"
                            style={{ borderColor: `${color}50`, borderLeftColor: color, backgroundColor: `${color}15` }}
                          >
                            {isStart ? (
                              <>
                                <span className="text-[11px] font-semibold leading-none truncate" style={{ color }}>
                                  🎾 {booking.teacher_name ?? 'Maestro'}
                                </span>
                                <span className="text-[10px] leading-none text-rg-dark/45">
                                  {fmtHM(booking.start_time)}–{fmtHM(booking.end_time)}
                                </span>
                              </>
                            ) : (
                              <span className="text-[10px] font-semibold" style={{ color: `${color}80` }}>↑</span>
                            )}
                          </div>
                        </td>
                      )
                    }

                    // 5. Prenotazione socio
                    if (booking) {
                      const isStart = new Date(booking.start_time).getUTCHours() === parseInt(slot)
                      return (
                        <td key={court.id} className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0">
                          <div className="h-[48px] rounded-xl border border-green-200 bg-yellow-50 border-l-[3px] border-l-green-600 flex flex-col justify-center px-2.5 gap-0.5">
                            {isStart ? (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <UserRound size={10} className="text-green-600 flex-shrink-0" />
                                  <span className="text-[11px] font-semibold text-green-700 leading-none">Socio</span>
                                </div>
                                <span className="text-[10px] text-green-500 leading-none pl-[18px]">{fmtHM(booking.start_time)}–{fmtHM(booking.end_time)}</span>
                              </>
                            ) : (
                              <span className="text-[10px] font-semibold text-green-500">↑</span>
                            )}
                          </div>
                        </td>
                      )
                    }

                    // 6. Slot libero — cliccabile
                    const slotId = `tslot-${court.id}-${slot}`
                    const isFirstAvail = slotId === firstAvailableSlotId
                    return (
                      <td key={court.id} className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0">
                        <button
                          id={isFirstAvail ? slotId : undefined}
                          type="button"
                          onClick={() => setModal({ courtId: court.id, courtName: court.name, startTime: slot })}
                          className={[
                            'w-full h-[48px] rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 group',
                            isFirstAvail
                              ? 'border-rg-clay/50 bg-rg-clay/5 hover:bg-rg-clay/10 hover:border-rg-clay'
                              : 'border-rg-dark/10 bg-white hover:border-rg-clay hover:bg-rg-clay/5',
                          ].join(' ')}
                        >
                          <span className={`text-xl font-light leading-none transition-colors duration-200 ${isFirstAvail ? 'text-rg-clay' : 'text-rg-dark/20 group-hover:text-rg-clay'}`}>+</span>
                          <span className={`text-[10px] font-medium leading-none transition-colors duration-200 ${isFirstAvail ? 'text-rg-clay/70' : 'text-rg-dark/20 group-hover:text-rg-clay/70'}`}>Prenota</span>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Lista lezioni del giorno ────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays size={15} className="text-rg-dark/40" />
          <h3 className="text-sm font-bold text-rg-dark capitalize">
            {date === today ? 'Lezioni di oggi' : `Lezioni — ${gridDateLabel}`}
          </h3>
          {myLessons.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rg-clay/10 text-rg-clay">
              {myLessons.length}
            </span>
          )}
        </div>

        {myLessons.length === 0 ? (
          <p className="text-sm text-rg-dark/35 py-4 text-center">Nessuna lezione per questo giorno</p>
        ) : (
          <div className="rounded-xl border border-rg-dark/10 overflow-hidden">
            {cancelError && (
              <div className="px-4 py-2 bg-red-50 border-b border-red-100">
                <p className="text-xs text-red-600">{cancelError}</p>
              </div>
            )}
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-rg-dark/[0.025]">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-rg-dark/40 uppercase tracking-widest">Orario</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-rg-dark/40 uppercase tracking-widest">Campo</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-rg-dark/40 uppercase tracking-widest">Allievo</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-rg-dark/40 uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody>
                {myLessons.map((lesson, idx) => {
                  const isLessonPast = new Date(lesson.end_time) <= new Date()
                  const court        = courts.find(c => c.id === lesson.court_id)
                  const isConfirming = cancelConfirm === lesson.id

                  return (
                    <tr
                      key={lesson.id}
                      className={`border-t border-rg-dark/6 ${isLessonPast ? 'opacity-40' : ''} ${idx % 2 === 0 ? 'bg-white' : 'bg-rg-dark/[0.012]'}`}
                    >
                      <td className="px-4 py-2.5 text-xs font-mono text-rg-dark tabular-nums whitespace-nowrap">
                        {fmtHM(lesson.start_time)}–{fmtHM(lesson.end_time)}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-rg-dark/60 whitespace-nowrap">
                        {court?.name ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-rg-dark truncate max-w-[120px]">
                        {lesson.student_name ?? '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {!isLessonPast && (
                          isConfirming ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-[11px] text-rg-dark/50">Sei sicuro?</span>
                              <button
                                type="button"
                                onClick={() => handleCancel(lesson.id)}
                                disabled={isPending}
                                className="text-[11px] font-bold text-red-600 hover:text-red-700 disabled:opacity-40"
                              >
                                {isPending ? '...' : 'Sì, annulla'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancelConfirm(null)}
                                className="text-[11px] text-rg-dark/40 hover:text-rg-dark"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setCancelConfirm(lesson.id)}
                              className="text-[11px] text-rg-dark/30 hover:text-red-500 transition-colors flex items-center gap-1 ml-auto"
                            >
                              <Trash2 size={12} />
                              Annulla
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── TeacherBookingModal ─────────────────────────────────────────────── */}
      {modal && (
        <TeacherBookingModal
          courtId={modal.courtId}
          courtName={modal.courtName}
          preSelectedDate={date}
          preSelectedStartTime={modal.startTime}
          onClose={() => {
            setModal(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
