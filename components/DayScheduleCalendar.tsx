'use client'

/**
 * DayScheduleCalendar — Google Calendar-style day view for the tennis court schedule.
 *
 * Renders one row per hour (08:00–22:00) for every active court, with:
 *  - Navigation: prev/next day, date picker, "Oggi" shortcut, scroll-to-first-free button
 *  - Quick-date shortcuts for fast navigation
 *  - Free slots: full-hour card with "+" to open SmartBookingModal (books 60 min)
 *  - Booked slots: clay event card (start) or continuation strip (subsequent hours)
 *  - Past / inapplicable slots shown with appropriate muted styling
 */

import Link from 'next/link'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, UserRound } from 'lucide-react'
import {
  type ScheduleCourt,
  type ScheduleBooking,
} from '@/components/GlobalScheduleGrid'
import SmartBookingModal from '@/components/SmartBookingModal'
import TeacherBookingModal from '@/components/TeacherBookingModal'

// ── Constants ─────────────────────────────────────────────────────────────────

/** 1-hour slots from 08:00 to 22:00 — 15 entries */
const HOUR_SLOTS = Array.from({ length: 15 }, (_, i) => {
  const h = 8 + i
  return `${String(h).padStart(2, '0')}:00`
})

// ── Types ─────────────────────────────────────────────────────────────────────

interface DayScheduleCalendarProps {
  courts:              ScheduleCourt[]    // { id, name, open_time, close_time }
  bookings:            ScheduleBooking[]  // { id, court_id, start_time, end_time } — stored in UTC (+00:00)
  date:                string             // YYYY-MM-DD — currently selected day
  today:               string             // YYYY-MM-DD — server-computed today
  userRole:            'admin' | 'member' | 'teacher'
  weatherBlockActive?: boolean            // when true, free slots are frozen (no booking allowed)
}

interface ModalState {
  courtId:   string
  courtName: string
  startTime: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Shifts a YYYY-MM-DD date string by `days` days without timezone drift. */
function offsetDate(d: string, days: number): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day + days).toLocaleDateString('en-CA')
}

/**
 * Returns true if a slot (HH:00) falls within the court's open/close window.
 * A slot is applicable when: slotHour >= open AND slotHour < close.
 */
function isApplicable(court: ScheduleCourt, slot: string): boolean {
  const [slotH, slotM]   = slot.split(':').map(Number)
  const [openH, openM]   = court.open_time.split(':').map(Number)
  const [closeH, closeM] = court.close_time.split(':').map(Number)
  const slotTotal  = slotH * 60 + slotM
  const openTotal  = openH * 60 + openM
  const closeTotal = closeH * 60 + closeM
  return slotTotal >= openTotal && slotTotal < closeTotal
}

/**
 * Returns any booking that overlaps the 1-hour window starting at `slot`.
 * Uses local-time Date for the window (matching the existing query boundary logic).
 */
function getBookingForHour(
  bookings: ScheduleBooking[],
  court: ScheduleCourt,
  date: string,
  slot: string,
): ScheduleBooking | null {
  const hourStart = new Date(`${date}T${slot}:00`)
  const hourEnd   = new Date(hourStart.getTime() + 60 * 60 * 1000)
  return (
    bookings.find(b => {
      if (b.court_id !== court.id) return false
      const bStart = new Date(b.start_time)
      const bEnd   = new Date(b.end_time)
      return bStart < hourEnd && bEnd > hourStart
    }) ?? null
  )
}

/**
 * Returns true if the booking's UTC start hour matches the given HH:00 slot hour.
 * A booking at 08:30 UTC is considered to start in the "08:00" hour row.
 */
function isBookingStart(booking: ScheduleBooking, slot: string): boolean {
  const [slotH] = slot.split(':').map(Number)
  return new Date(booking.start_time).getUTCHours() === slotH
}

/**
 * Formats a booking's UTC start and end times as "HH:MM – HH:MM".
 */
function formatBookingTime(booking: ScheduleBooking): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const s = new Date(booking.start_time)
  const e = new Date(booking.end_time)
  return `${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())} – ${pad(e.getUTCHours())}:${pad(e.getUTCMinutes())}`
}

/**
 * Returns true if the slot's local datetime is in the past relative to `now`.
 * Compares the full hour (HH:00) so that the current hour remains bookable.
 */
function isPastSlot(date: string, slot: string, now: Date): boolean {
  // A slot is past when the NEXT hour has already started
  const slotDate = new Date(`${date}T${slot}:00`)
  const slotEnd  = new Date(slotDate.getTime() + 60 * 60 * 1000)
  return slotEnd <= now
}

// ── Component ─────────────────────────────────────────────────────────────────

/** Generates an array of quick-shortcut days relative to today */
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

export default function DayScheduleCalendar({
  courts,
  bookings,
  date,
  today,
  userRole,
  weatherBlockActive = false,
}: DayScheduleCalendarProps) {
  const now         = new Date()
  const router      = useRouter()
  const dateInputRef = useRef<HTMLInputElement>(null)

  const [modal, setModal]               = useState<ModalState | null>(null)
  const [teacherModal, setTeacherModal] = useState<ModalState | null>(null)

  const prevDay = offsetDate(date, -1)
  const nextDay = offsetDate(date, +1)
  const shortcuts = getShortcutDays(today)

  const gridDateLabel = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
  }).format(new Date(`${date}T12:00:00`))

  // ── First available slot ──────────────────────────────────────────────────
  let firstAvailableSlotId: string | null = null
  outer: for (const slot of HOUR_SLOTS) {
    for (const court of courts) {
      if (!isApplicable(court, slot)) continue
      if (isPastSlot(date, slot, now)) continue
      if (getBookingForHour(bookings, court, date, slot) !== null) continue
      firstAvailableSlotId = `slot-${court.id}-${slot}`
      break outer
    }
  }

  function scrollToFirstAvailable() {
    if (!firstAvailableSlotId) return
    document.getElementById(firstAvailableSlotId)?.scrollIntoView({
      behavior: 'smooth',
      block:    'center',
    })
  }

  const tableMinWidth = `${52 + courts.length * 140}px`

  return (
    <div className="flex flex-col gap-5 max-w-[70%] mx-auto px-2">

      {/* ── Section title ──────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-rg-dark tracking-tight">
          Panoramica: Tutti i Campi
        </h2>
        <p className="text-sm text-rg-dark/45 mt-0.5 capitalize">{gridDateLabel}</p>
      </div>

      {/* ── Navigation header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">

        {/* Previous day */}
        <Link
          href={`/dashboard?date=${prevDay}`}
          className="w-9 h-9 rounded-full flex items-center justify-center
            border border-rg-dark/15 text-rg-dark/50 font-bold text-base
            hover:border-rg-clay hover:text-rg-clay hover:bg-rg-clay/5
            transition-all duration-150 flex-shrink-0"
          aria-label="Giorno precedente"
        >
          ←
        </Link>

        {/* Date label + calendar picker trigger */}
        <button
          type="button"
          onClick={() => dateInputRef.current?.showPicker()}
          className="flex-1 flex items-center justify-center gap-2 font-bold text-rg-dark text-base capitalize
            hover:text-rg-clay transition-colors duration-150 group"
        >
          <span>{gridDateLabel}</span>
          <CalendarDays size={15} className="text-rg-dark/30 group-hover:text-rg-clay transition-colors" />
        </button>
        {/* Hidden native date input */}
        <input
          ref={dateInputRef}
          type="date"
          value={date}
          onChange={(e) => { if (e.target.value) router.push(`/dashboard?date=${e.target.value}`) }}
          className="sr-only"
          aria-hidden="true"
        />

        {/* Next day */}
        <Link
          href={`/dashboard?date=${nextDay}`}
          className="w-9 h-9 rounded-full flex items-center justify-center
            border border-rg-dark/15 text-rg-dark/50 font-bold text-base
            hover:border-rg-clay hover:text-rg-clay hover:bg-rg-clay/5
            transition-all duration-150 flex-shrink-0"
          aria-label="Giorno successivo"
        >
          →
        </Link>

        {/* "Oggi" pill */}
        {date !== today && (
          <Link
            href="/dashboard"
            className="px-4 py-1.5 rounded-full text-sm font-semibold flex-shrink-0
              bg-rg-clay text-white hover:bg-rg-dark transition-colors duration-150"
          >
            Oggi
          </Link>
        )}

        {/* First available button */}
        {firstAvailableSlotId && (
          <button
            type="button"
            onClick={scrollToFirstAvailable}
            className="px-4 py-1.5 rounded-full text-sm font-semibold flex-shrink-0
              border-2 border-rg-clay/40 text-rg-clay bg-white
              hover:bg-rg-clay/8 transition-colors duration-150"
          >
            ↓ Primo libero
          </button>
        )}
      </div>

      {/* ── Quick-date shortcuts ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mb-1">
        {shortcuts.map(({ date: d, label, sublabel }) => {
          const isActive = d === date
          return (
            <Link
              key={d}
              href={`/dashboard?date=${d}`}
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

      {/* ── Schedule grid ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-rg-dark/12 shadow-sm w-full overflow-x-auto pb-2">
        <table
          className="w-full border-collapse"
          style={{ minWidth: tableMinWidth }}
        >

          {/* Header */}
          <thead>
            <tr style={{ background: '#311815' }}>
              <th className="w-[52px] px-3 py-3 text-left text-[10px] font-bold text-white/40 uppercase tracking-widest border-r border-white/8">
                ORA
              </th>
              {courts.map(court => (
                <th
                  key={court.id}
                  className="px-3 py-3 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-white/8 last:border-r-0"
                >
                  {court.name}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {HOUR_SLOTS.map((slot, rowIdx) => {
              const bandEven = rowIdx % 2 === 0

              return (
                <tr
                  key={`${date}-${slot}`}
                  className={`border-t border-rg-dark/[0.06] ${bandEven ? 'bg-white' : 'bg-rg-dark/[0.015]'}`}
                >
                  {/* Time label */}
                  <td className="px-3 py-2 w-[52px] border-r border-rg-dark/8 align-top">
                    <span className="text-xs font-bold text-rg-dark leading-none">{slot}</span>
                  </td>

                  {/* Court cells */}
                  {courts.map(court => {
                    // ── Not applicable ──────────────────────────────────────
                    if (!isApplicable(court, slot)) {
                      return (
                        <td
                          key={court.id}
                          className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0 bg-rg-dark/[0.025]"
                        >
                          <div className="h-[48px] rounded-xl flex items-center justify-center">
                            <span className="text-xs text-rg-dark/20 select-none font-medium">—</span>
                          </div>
                        </td>
                      )
                    }

                    // ── Past slot ───────────────────────────────────────────
                    if (isPastSlot(date, slot, now)) {
                      return (
                        <td
                          key={court.id}
                          className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0"
                        >
                          <div className="h-[48px] rounded-xl bg-rg-dark/[0.03] flex items-center justify-center">
                            <span className="text-xs text-rg-dark/25 font-medium select-none">Passato</span>
                          </div>
                        </td>
                      )
                    }

                    const booking = getBookingForHour(bookings, court, date, slot)

                    // ── Booked ─────────────────────────────────────────────
                    if (booking) {
                      // Teacher booking: usa colore dinamico del maestro
                      if (booking.booking_type === 'teacher') {
                        const color = booking.teacher_color ?? '#6366f1'
                        return (
                          <td
                            key={court.id}
                            className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0"
                          >
                            <div
                              style={{
                                borderLeftColor: color,
                                borderColor: `${color}60`,
                                backgroundColor: `${color}22`,
                              }}
                              className="h-[48px] rounded-xl border border-l-[4px] flex flex-col justify-center px-3 gap-1"
                            >
                              <span style={{ color }} className="text-xs font-bold leading-none truncate">
                                🎾 {booking.teacher_name ?? 'Maestro'}
                              </span>
                              {isBookingStart(booking, slot) && (
                                <span className="text-[11px] text-rg-dark/65 leading-none font-medium">
                                  {formatBookingTime(booking)}
                                </span>
                              )}
                            </div>
                          </td>
                        )
                      }

                      // Member booking — start
                      if (isBookingStart(booking, slot)) {
                        return (
                          <td
                            key={court.id}
                            className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0"
                          >
                            <div className="h-[48px] rounded-xl border border-green-200 bg-yellow-50 border-l-[4px] border-l-green-600 flex flex-col justify-center px-3 gap-1">
                              <div className="flex items-center gap-1.5">
                                <UserRound size={11} className="text-green-600 flex-shrink-0" />
                                <span className="text-xs font-bold text-green-700 leading-none">Socio</span>
                              </div>
                              <span className="text-[11px] text-green-500 pl-[18px] leading-none font-medium">
                                {formatBookingTime(booking)}
                              </span>
                            </div>
                          </td>
                        )
                      }

                      // Member booking — continuation
                      return (
                        <td
                          key={court.id}
                          className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0"
                        >
                          <div className="h-[48px] rounded-xl bg-yellow-50 border border-green-200 border-l-[4px] border-l-green-600 flex items-center px-3">
                            <span className="text-xs font-semibold text-green-500">↑</span>
                          </div>
                        </td>
                      )
                    }

                    // ── Free slot ───────────────────────────────────────────
                    const slotId = `slot-${court.id}-${slot}`
                    const isFirstAvail = slotId === firstAvailableSlotId

                    // Weather block: show frozen state instead of booking button
                    if (weatherBlockActive) {
                      return (
                        <td
                          key={court.id}
                          className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0"
                        >
                          <div className="h-[48px] rounded-xl border-2 border-sky-200/60 bg-sky-50/50 flex flex-col items-center justify-center gap-1 select-none">
                            <span className="text-base leading-none">⛈</span>
                            <span className="text-[10px] font-semibold text-sky-600/80 leading-none">Inagibile</span>
                          </div>
                        </td>
                      )
                    }

                    return (
                      <td
                        key={court.id}
                        className="px-1.5 py-1.5 border-r border-rg-dark/6 last:border-r-0"
                      >
                        <button
                          id={isFirstAvail && firstAvailableSlotId ? firstAvailableSlotId : undefined}
                          onClick={() => {
                            if (userRole === 'teacher') {
                              setTeacherModal({ courtId: court.id, courtName: court.name, startTime: slot })
                            } else {
                              setModal({ courtId: court.id, courtName: court.name, startTime: slot })
                            }
                          }}
                          className={[
                            'w-full h-[48px] rounded-xl border-2 flex flex-col items-center justify-center gap-1',
                            'transition-all duration-200 group',
                            isFirstAvail
                              ? 'border-rg-clay/50 bg-rg-clay/5 hover:bg-rg-clay/10 hover:border-rg-clay'
                              : 'border-rg-dark/10 bg-white hover:border-rg-clay hover:bg-rg-clay/5',
                          ].join(' ')}
                        >
                          <span className={[
                            'text-2xl font-light leading-none transition-colors duration-200',
                            isFirstAvail
                              ? 'text-rg-clay'
                              : 'text-rg-dark/20 group-hover:text-rg-clay',
                          ].join(' ')}>
                            +
                          </span>
                          <span className={[
                            'text-[10px] font-medium leading-none transition-colors duration-200',
                            isFirstAvail
                              ? 'text-rg-clay/70'
                              : 'text-rg-dark/20 group-hover:text-rg-clay/70',
                          ].join(' ')}>
                            Prenota
                          </span>
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

      {/* SmartBookingModal */}
      {modal && (
        <SmartBookingModal
          courtId={modal.courtId}
          courtName={modal.courtName}
          preSelectedDate={date}
          preSelectedStartTime={modal.startTime}
          onClose={() => setModal(null)}
        />
      )}

      {/* TeacherBookingModal */}
      {teacherModal && (
        <TeacherBookingModal
          courtId={teacherModal.courtId}
          courtName={teacherModal.courtName}
          preSelectedDate={date}
          preSelectedStartTime={teacherModal.startTime}
          onClose={() => setTeacherModal(null)}
        />
      )}
    </div>
  )
}
