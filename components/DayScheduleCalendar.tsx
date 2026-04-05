'use client'

/**
 * DayScheduleCalendar — Google Calendar-style day view for the tennis court schedule.
 *
 * Renders a full-day grid for all courts on a given date, with:
 *  - Navigation header (prev/next day links, "Oggi" shortcut, "scroll to first free" button)
 *  - A compact HTML table with 30-min slots (08:00 – 23:30) for every active court
 *  - Visual differentiation between: not-applicable, past, booked (start + continuation), and free slots
 *  - SmartBookingModal launched on clicking a free slot cell
 */

import Link from 'next/link'
import { useState } from 'react'
import {
  type ScheduleCourt,
  type ScheduleBooking,
} from '@/components/GlobalScheduleGrid'
import SmartBookingModal from '@/components/SmartBookingModal'

// ── Constants ─────────────────────────────────────────────────────────────────

/** 30-min slots from 08:00 to 23:30 — 31 entries total */
const SLOTS = Array.from({ length: 31 }, (_, i) => {
  const t = 8 * 60 + i * 30
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
})

// ── Types ─────────────────────────────────────────────────────────────────────

interface DayScheduleCalendarProps {
  courts:   ScheduleCourt[]    // { id, name, open_time, close_time }
  bookings: ScheduleBooking[]  // { id, court_id, start_time, end_time } — stored in UTC with +00:00
  date:     string             // YYYY-MM-DD — currently selected day
  today:    string             // YYYY-MM-DD — server-computed today
}

interface ModalState {
  courtId:   string
  courtName: string
  startTime: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Shifts a YYYY-MM-DD date string by `days` days without timezone drift.
 * Uses numeric year/month/day to avoid UTC conversion issues.
 */
function offsetDate(d: string, days: number): string {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day + days).toLocaleDateString('en-CA')
}

/**
 * Returns true if a given slot (HH:MM) falls within the court's open/close window.
 * A slot is applicable when: slotStart >= open_time AND slotStart < close_time.
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
 * Returns the booking that overlaps the given slot for the given court, or null.
 * Uses a local-time Date for slotStart (matching the booking query boundary logic).
 */
function getBooking(
  bookings: ScheduleBooking[],
  court: ScheduleCourt,
  date: string,
  slot: string,
): ScheduleBooking | null {
  const slotStart = new Date(`${date}T${slot}:00`)
  const slotEnd   = new Date(slotStart.getTime() + 30 * 60 * 1000)
  return (
    bookings.find(b => {
      if (b.court_id !== court.id) return false
      const bStart = new Date(b.start_time)
      const bEnd   = new Date(b.end_time)
      return bStart < slotEnd && bEnd > slotStart
    }) ?? null
  )
}

/**
 * Returns true if the booking's UTC start matches the given HH:MM slot.
 * Uses getUTCHours/getUTCMinutes because bookings are stored in UTC (+00:00).
 */
function isBookingStart(booking: ScheduleBooking, slot: string): boolean {
  const [slotH, slotM] = slot.split(':').map(Number)
  const bStart = new Date(booking.start_time)
  return bStart.getUTCHours() === slotH && bStart.getUTCMinutes() === slotM
}

/**
 * Formats a booking's UTC start and end times as "HH:MM – HH:MM".
 * Uses getUTCHours/getUTCMinutes because bookings are stored in UTC.
 */
function formatBookingTime(booking: ScheduleBooking): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const s = new Date(booking.start_time)
  const e = new Date(booking.end_time)
  return `${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())} – ${pad(e.getUTCHours())}:${pad(e.getUTCMinutes())}`
}

/**
 * Returns true if the slot's local datetime is in the past relative to `now`.
 */
function isPastSlot(date: string, slot: string, now: Date): boolean {
  return new Date(`${date}T${slot}:00`) < now
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DayScheduleCalendar({
  courts,
  bookings,
  date,
  today,
}: DayScheduleCalendarProps) {
  const now     = new Date()
  const [modal, setModal] = useState<ModalState | null>(null)

  const prevDay = offsetDate(date, -1)
  const nextDay = offsetDate(date, +1)

  /** Human-readable date label in Italian (capitalized) */
  const gridDateLabel = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
  }).format(new Date(`${date}T12:00:00`))

  // ── First available slot ──────────────────────────────────────────────────
  // Iterate slots in order, then courts, to find the earliest free applicable future slot.
  let firstAvailableSlotId: string | null = null

  outer: for (const slot of SLOTS) {
    for (const court of courts) {
      if (!isApplicable(court, slot)) continue
      if (isPastSlot(date, slot, now)) continue
      if (getBooking(bookings, court, date, slot) !== null) continue
      firstAvailableSlotId = `slot-${court.id}-${slot}`
      break outer
    }
  }

  /** Smoothly scrolls the first available slot into view */
  function scrollToFirstAvailable() {
    if (!firstAvailableSlotId) return
    document.getElementById(firstAvailableSlotId)?.scrollIntoView({
      behavior: 'smooth',
      block:    'center',
    })
  }

  // ── Table min-width ensures horizontal scroll on mobile ──────────────────
  const tableMinWidth = `${56 + courts.length * 180}px`

  return (
    <div className="flex flex-col gap-4">

      {/* ── Section title ──────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-xl font-bold text-rg-dark tracking-tight">
          Panoramica: Tutti i Campi
        </h2>
        <p className="text-sm text-rg-dark/45 mt-0.5 capitalize">{gridDateLabel}</p>
      </div>

      {/* ── Navigation header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Previous day */}
        <Link
          href={`/dashboard?date=${prevDay}`}
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
            border border-rg-dark/12 text-rg-dark/55
            hover:border-rg-clay/50 hover:text-rg-clay hover:bg-rg-clay/5
            transition-all duration-150 flex-shrink-0"
          aria-label="Giorno precedente"
        >
          ←
        </Link>

        {/* Date label — centered, grows to fill available space */}
        <span className="flex-1 text-center font-bold text-rg-dark text-sm capitalize min-w-[140px]">
          {gridDateLabel}
        </span>

        {/* Next day */}
        <Link
          href={`/dashboard?date=${nextDay}`}
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
            border border-rg-dark/12 text-rg-dark/55
            hover:border-rg-clay/50 hover:text-rg-clay hover:bg-rg-clay/5
            transition-all duration-150 flex-shrink-0"
          aria-label="Giorno successivo"
        >
          →
        </Link>

        {/* "Oggi" pill — only shown when not viewing today */}
        {date !== today && (
          <Link
            href="/dashboard"
            className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0
              bg-rg-clay text-white hover:bg-rg-dark transition-colors duration-150"
          >
            Oggi
          </Link>
        )}

        {/* "First available" button — hidden when no free slot exists */}
        {firstAvailableSlotId && (
          <button
            type="button"
            onClick={scrollToFirstAvailable}
            className="px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0
              border border-rg-clay/40 text-rg-clay bg-white
              hover:bg-rg-clay/8 transition-colors duration-150"
          >
            ↓ Primo libero
          </button>
        )}
      </div>

      {/* ── Schedule grid ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-rg-dark/12 shadow-sm w-full overflow-x-auto pb-4">
        <table
          className="w-full text-xs border-collapse"
          style={{ minWidth: tableMinWidth }}
        >

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <thead>
            <tr style={{ background: '#311815' }}>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold text-white/40 uppercase tracking-widest w-14 border-r border-white/8">
                ORA
              </th>
              {courts.map(court => (
                <th
                  key={court.id}
                  className="px-3 py-2.5 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-white/8 last:border-r-0"
                >
                  {court.name}
                </th>
              ))}
            </tr>
          </thead>

          {/* ── Body ───────────────────────────────────────────────────────── */}
          <tbody>
            {SLOTS.map((slot, rowIdx) => {
              const isOnTheHour = slot.endsWith(':00')
              // Alternate background by hour-pair bands (every 2 rows = 1 hour)
              const bandEven = Math.floor(rowIdx / 2) % 2 === 0

              return (
                <tr
                  key={`${date}-${slot}`}
                  className={[
                    bandEven ? 'bg-white' : 'bg-rg-dark/[0.02]',
                    isOnTheHour && rowIdx > 0 ? 'border-t border-rg-dark/10' : '',
                  ].join(' ')}
                >
                  {/* Time label */}
                  <td
                    className={[
                      'px-3 py-1 border-r border-rg-dark/8 w-14 whitespace-nowrap select-none',
                      isOnTheHour ? 'font-bold text-rg-dark' : 'font-normal text-rg-dark/25',
                    ].join(' ')}
                  >
                    {slot}
                  </td>

                  {/* Court cells */}
                  {courts.map(court => {
                    // ── (a) Not applicable ────────────────────────────────────
                    if (!isApplicable(court, slot)) {
                      return (
                        <td
                          key={court.id}
                          className="px-1 py-0.5 border-r border-rg-dark/6 last:border-r-0 bg-rg-dark/[0.03]"
                        >
                          <span className="flex items-center justify-center py-0.5 px-2 text-[10px] text-rg-dark/15 select-none">
                            —
                          </span>
                        </td>
                      )
                    }

                    // ── (b) Past slot ─────────────────────────────────────────
                    if (isPastSlot(date, slot, now)) {
                      return (
                        <td
                          key={court.id}
                          className="px-1 py-0.5 border-r border-rg-dark/6 last:border-r-0 opacity-30"
                        >
                          <span className="flex items-center justify-center py-0.5 px-2 text-[10px] text-rg-dark/30 select-none">
                            Passato
                          </span>
                        </td>
                      )
                    }

                    const booking = getBooking(bookings, court, date, slot)

                    // ── (c) Booked — start slot ───────────────────────────────
                    if (booking && isBookingStart(booking, slot)) {
                      return (
                        <td
                          key={court.id}
                          className="px-1 py-0.5 border-r border-rg-dark/6 last:border-r-0"
                        >
                          <div className="rounded-lg border-l-[3px] border-rg-clay bg-rg-clay/15 px-2 py-1">
                            <p className="font-semibold text-[11px] text-rg-clay leading-tight">
                              <span className="mr-1">●</span>
                              Prenotato
                            </p>
                            <p className="text-[10px] text-rg-dark/45 mt-0.5">
                              {formatBookingTime(booking)}
                            </p>
                          </div>
                        </td>
                      )
                    }

                    // ── (d) Booked — continuation slot ────────────────────────
                    if (booking && !isBookingStart(booking, slot)) {
                      return (
                        <td
                          key={court.id}
                          className="px-1 py-0.5 border-r border-rg-dark/6 last:border-r-0"
                        >
                          <div className="rounded-sm border-l-2 border-rg-clay/30 bg-rg-clay/8 h-full min-h-[18px]" />
                        </td>
                      )
                    }

                    // ── (e) Free slot ─────────────────────────────────────────
                    const slotId = `slot-${court.id}-${slot}`
                    const isFirstAvail = slotId === firstAvailableSlotId

                    return (
                      <td
                        key={court.id}
                        className="px-1 py-0.5 border-r border-rg-dark/6 last:border-r-0"
                      >
                        <button
                          id={isFirstAvail && firstAvailableSlotId ? firstAvailableSlotId : undefined}
                          onClick={() =>
                            setModal({
                              courtId:   court.id,
                              courtName: court.name,
                              startTime: slot,
                            })
                          }
                          className={[
                            'w-full group rounded-lg border border-dashed transition-all duration-150 px-2 py-1.5 text-center',
                            isFirstAvail
                              ? 'border-rg-clay/30 bg-rg-clay/[0.03] hover:border-rg-clay/50 hover:bg-rg-clay/5'
                              : 'border-rg-dark/15 hover:border-rg-clay/50 hover:bg-rg-clay/5',
                          ].join(' ')}
                        >
                          <span className="text-sm font-light text-rg-dark/30 group-hover:text-rg-clay transition-colors">
                            +
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

      {/* ── SmartBookingModal ───────────────────────────────────────────────── */}
      {modal && (
        <SmartBookingModal
          courtId={modal.courtId}
          courtName={modal.courtName}
          preSelectedDate={date}
          preSelectedStartTime={modal.startTime}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
