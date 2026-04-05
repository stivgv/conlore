'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Trash2, CalendarDays } from 'lucide-react'
import { type ScheduleCourt, type ScheduleBooking } from '@/components/GlobalScheduleGrid'
import TeacherBookingModal from '@/components/TeacherBookingModal'
import { teacherCancelBooking } from '@/app/dashboard/actions'

// Estende ScheduleBooking con user_id per distinguere "mia lezione" da "prenotazione altrui"
type WeekBooking = ScheduleBooking & { user_id: string }

interface TeacherWeeklyCalendarProps {
  courts:       ScheduleCourt[]
  bookings:     WeekBooking[]
  weekStart:    string    // YYYY-MM-DD (lunedì)
  today:        string    // YYYY-MM-DD
  teacherId:    string
  teacherName:  string
  teacherColor: string    // hex es. '#6366f1'
}

// 15 slot da 08:00 a 22:00
const HOUR_SLOTS = Array.from({ length: 15 }, (_, i) =>
  `${String(8 + i).padStart(2, '0')}:00`
)

/** Calcola i 7 giorni della settimana a partire da weekStart */
function getWeekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const [y, m, d] = weekStart.split('-').map(Number)
    return new Date(y, m - 1, d + i).toLocaleDateString('en-CA')
  })
}

/** Sposta una data YYYY-MM-DD di N giorni */
function offsetDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d + days).toLocaleDateString('en-CA')
}

/** True se lo slot è nell'orario di apertura del campo */
function isApplicable(court: ScheduleCourt, slot: string): boolean {
  const [sh, sm] = slot.split(':').map(Number)
  const [oh, om] = court.open_time.split(':').map(Number)
  const [ch, cm] = court.close_time.split(':').map(Number)
  return (sh * 60 + sm) >= (oh * 60 + om) && (sh * 60 + sm) < (ch * 60 + cm)
}

/** Trova la booking che occupa questo campo+giorno+slot (sovrapposizione di 1h) */
function getBooking(bookings: WeekBooking[], courtId: string, date: string, slot: string): WeekBooking | null {
  const start = new Date(`${date}T${slot}:00`)
  const end   = new Date(start.getTime() + 3_600_000)
  return bookings.find(b =>
    b.court_id === courtId &&
    new Date(b.start_time) < end &&
    new Date(b.end_time)   > start
  ) ?? null
}

/** True se lo slot è già passato */
function isPast(date: string, slot: string): boolean {
  return new Date(`${date}T${slot}:00`).getTime() + 3_600_000 <= Date.now()
}

/** Formatta ISO → HH:MM (UTC) */
function fmtHM(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** Formatta YYYY-MM-DD → "Lun 07/04" */
function fmtDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const wd = date.toLocaleDateString('it-IT', { weekday: 'short' })
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)} ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`
}

export default function TeacherWeeklyCalendar({
  courts, bookings, weekStart, today, teacherId, teacherName, teacherColor,
}: TeacherWeeklyCalendarProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Tabs campi: default primo campo
  const [selectedCourtId, setSelectedCourtId] = useState<string>(courts[0]?.id ?? '')

  // Modal prenotazione
  const [modal, setModal] = useState<{
    courtId: string; courtName: string; date: string; startTime: string
  } | null>(null)

  // Cancellazione inline con doppia conferma
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null) // bookingId
  const [cancelError, setCancelError] = useState<string | null>(null)

  const weekDays = getWeekDays(weekStart)
  const prevWeek = offsetDate(weekStart, -7)
  const nextWeek = offsetDate(weekStart, 7)

  const selectedCourt = courts.find(c => c.id === selectedCourtId) ?? courts[0]

  // Lezioni del maestro questa settimana (per lista compatta)
  const myLessons = bookings
    .filter(b => b.user_id === teacherId)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))

  /** Gestisce la cancellazione di una lezione tramite server action */
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

  return (
    <div className="flex flex-col gap-0">
      {/* Titolo sezione */}
      <h2 className="text-xl font-bold text-rg-dark mb-5">Calendario Settimanale</h2>

      {/* Riga: court tabs + week nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">

        {/* Court tabs */}
        <div className="flex items-center gap-1 bg-rg-dark/5 p-1 rounded-xl">
          {courts.map(court => (
            <button
              key={court.id}
              onClick={() => setSelectedCourtId(court.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                selectedCourtId === court.id
                  ? 'bg-white shadow-sm text-rg-dark'
                  : 'text-rg-dark/50 hover:text-rg-dark'
              }`}
            >
              {court.name}
            </button>
          ))}
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/teacher?week=${prevWeek}`}
            className="w-8 h-8 rounded-full border border-rg-dark/15 flex items-center justify-center text-rg-dark/50 hover:border-rg-clay hover:text-rg-clay transition-colors"
          >
            <ChevronLeft size={15} />
          </Link>

          {/* Week range label */}
          <span className="text-sm font-semibold text-rg-dark min-w-[160px] text-center">
            {(() => {
              const [y, m, d] = weekStart.split('-').map(Number)
              const start = new Date(y, m - 1, d)
              const end   = new Date(y, m - 1, d + 6)
              const fmt   = (dt: Date) => dt.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
              return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`
            })()}
          </span>

          <Link
            href={`/dashboard/teacher?week=${nextWeek}`}
            className="w-8 h-8 rounded-full border border-rg-dark/15 flex items-center justify-center text-rg-dark/50 hover:border-rg-clay hover:text-rg-clay transition-colors"
          >
            <ChevronRight size={15} />
          </Link>

          {/* "Oggi" se non siamo sulla settimana corrente */}
          {weekStart !== (() => {
            const now = new Date()
            const day = now.getDay()
            const diff = day === 0 ? -6 : 1 - day
            const monday = new Date(now)
            monday.setDate(now.getDate() + diff)
            return monday.toLocaleDateString('en-CA')
          })() && (
            <Link
              href="/dashboard/teacher"
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-rg-clay/10 text-rg-clay hover:bg-rg-clay/20 transition-colors"
            >
              Oggi
            </Link>
          )}
        </div>
      </div>

      {/* Grid container — scrollable orizzontalmente su mobile */}
      <div className="rounded-2xl overflow-hidden border border-rg-dark/12 shadow-sm overflow-x-auto mb-8">
        <table className="border-collapse" style={{ minWidth: `${60 + 7 * 140}px`, width: '100%' }}>
          <thead>
            <tr style={{ background: '#311815' }}>
              <th className="w-[60px] px-3 py-3 text-left text-[10px] font-bold text-white/40 uppercase tracking-widest border-r border-white/8">
                Ora
              </th>
              {weekDays.map(day => {
                const isToday = day === today
                const isDayPast = day < today
                return (
                  <th
                    key={day}
                    className={`px-2 py-3 text-center text-[11px] font-bold uppercase tracking-wide border-r border-white/8 last:border-r-0 ${
                      isToday ? 'text-rg-clay' : isDayPast ? 'text-white/30' : 'text-white/70'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span>{fmtDayLabel(day)}</span>
                      {isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rg-clay" />
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {HOUR_SLOTS.map((slot, rowIdx) => {
              const bandEven = rowIdx % 2 === 0
              return (
                <tr
                  key={slot}
                  className={`border-t border-rg-dark/[0.06] ${bandEven ? 'bg-white' : 'bg-rg-dark/[0.015]'}`}
                >
                  {/* Time label */}
                  <td className="px-3 py-0 w-[60px] border-r border-rg-dark/8 align-middle">
                    <span className="text-xs font-bold text-rg-dark/60">{slot}</span>
                  </td>

                  {/* Day cells */}
                  {weekDays.map(day => {
                    if (!selectedCourt) return <td key={day} />

                    // 1. Fuori orario campo
                    if (!isApplicable(selectedCourt, slot)) {
                      return (
                        <td key={day} className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0 bg-rg-dark/[0.025]">
                          <div className="h-[56px] rounded-lg flex items-center justify-center">
                            <span className="text-[11px] text-rg-dark/20 select-none">—</span>
                          </div>
                        </td>
                      )
                    }

                    // 2. Passato
                    if (isPast(day, slot)) {
                      return (
                        <td key={day} className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0">
                          <div className="h-[56px] rounded-lg bg-rg-dark/[0.03] flex items-center justify-center">
                            <span className="text-[11px] text-rg-dark/20 select-none">Passato</span>
                          </div>
                        </td>
                      )
                    }

                    const booking = getBooking(bookings, selectedCourt.id, day, slot)

                    // 3. Mia lezione
                    if (booking && booking.user_id === teacherId) {
                      const color = teacherColor
                      const isStart = new Date(booking.start_time).getUTCHours() === parseInt(slot)
                      return (
                        <td key={day} className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0">
                          <div
                            className="h-[56px] rounded-lg border border-l-[3px] flex flex-col justify-center px-2.5 gap-0.5"
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

                    // 4. Prenotato da altri
                    if (booking) {
                      const isTeacherBooking = booking.booking_type === 'teacher'
                      const label = isTeacherBooking
                        ? (booking.teacher_name ?? 'Maestro')
                        : 'Occupato'
                      const isStart = new Date(booking.start_time).getUTCHours() === parseInt(slot)
                      return (
                        <td key={day} className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0">
                          <div className="h-[56px] rounded-lg border border-rg-clay/40 border-l-[3px] border-l-rg-clay bg-rg-clay/12 flex flex-col justify-center px-2.5 gap-0.5">
                            {isStart ? (
                              <>
                                <span className="text-[11px] font-semibold text-rg-clay leading-none truncate">{label}</span>
                                <span className="text-[10px] text-rg-clay/60 leading-none">{fmtHM(booking.start_time)}–{fmtHM(booking.end_time)}</span>
                              </>
                            ) : (
                              <span className="text-[10px] font-semibold text-rg-clay/60">↑</span>
                            )}
                          </div>
                        </td>
                      )
                    }

                    // 5. Libero — cliccabile
                    return (
                      <td key={day} className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0">
                        <button
                          type="button"
                          onClick={() => setModal({
                            courtId: selectedCourt.id,
                            courtName: selectedCourt.name,
                            date: day,
                            startTime: slot,
                          })}
                          className="w-full h-[56px] rounded-lg border-2 border-dashed border-rg-dark/10 bg-white hover:border-rg-clay hover:bg-rg-clay/5 transition-all group flex items-center justify-center"
                        >
                          <span className="text-xl font-light text-rg-dark/15 group-hover:text-rg-clay transition-colors">+</span>
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

      {/* Lista lezioni settimana */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays size={15} className="text-rg-dark/40" />
          <h3 className="text-sm font-bold text-rg-dark">Lezioni questa settimana</h3>
          {myLessons.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rg-clay/10 text-rg-clay">
              {myLessons.length}
            </span>
          )}
        </div>

        {myLessons.length === 0 ? (
          <p className="text-sm text-rg-dark/35 py-4 text-center">Nessuna lezione prenotata questa settimana</p>
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
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-rg-dark/40 uppercase tracking-widest">Data</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-rg-dark/40 uppercase tracking-widest">Orario</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-rg-dark/40 uppercase tracking-widest">Campo</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-rg-dark/40 uppercase tracking-widest">Allievo</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-rg-dark/40 uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody>
                {myLessons.map((lesson, idx) => {
                  const lessonDate = lesson.start_time.slice(0, 10)
                  const isLessonPast = new Date(lesson.end_time) <= new Date()
                  const court = courts.find(c => c.id === lesson.court_id)
                  const isConfirming = cancelConfirm === lesson.id

                  return (
                    <tr
                      key={lesson.id}
                      className={`border-t border-rg-dark/6 ${
                        isLessonPast ? 'opacity-40' : ''
                      } ${idx % 2 === 0 ? 'bg-white' : 'bg-rg-dark/[0.012]'}`}
                    >
                      <td className="px-4 py-2.5 text-xs font-medium text-rg-dark/60 whitespace-nowrap">
                        {fmtDayLabel(lessonDate)}
                      </td>
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

      {/* TeacherBookingModal */}
      {modal && (
        <TeacherBookingModal
          courtId={modal.courtId}
          courtName={modal.courtName}
          preSelectedDate={modal.date}
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
