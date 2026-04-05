'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SmartBookingModal from '@/components/SmartBookingModal'
import { ChevronLeft, Calendar } from 'lucide-react'

export type SlotData = {
  time: string    // "09:00"
  booked: boolean
  past: boolean
}

export type DateChip = {
  label: string
  value: string   // YYYY-MM-DD
}

interface CourtScheduleClientProps {
  court: {
    id: string
    name: string
    surface_type: string
    open_time: string
    close_time: string
  }
  slots: SlotData[]
  date: string
  today: string
  chipDates: DateChip[]
}

/** Add one hour to a HH:MM string */
function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function CourtScheduleClient({
  court,
  slots,
  date,
  today,
  chipDates,
}: CourtScheduleClientProps) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const router       = useRouter()
  const dateInputRef = useRef<HTMLInputElement>(null)

  // Use optional chaining to guard against nullable open_time / close_time from the DB
  const openTime    = court.open_time?.slice(0, 5)  ?? '—'
  const closeTime   = court.close_time?.slice(0, 5) ?? '—'
  const available   = slots.filter(s => !s.booked && !s.past).length
  const isChipDate  = chipDates.some(c => c.value === date)

  const displayDate = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))

  function openDatePicker() {
    const input = dateInputRef.current
    if (!input) return
    // Prefer the native showPicker API (modern browsers); fall back to .click()
    if ('showPicker' in (input as HTMLInputElement)) {
      (input as HTMLInputElement & { showPicker(): void }).showPicker()
    } else {
      (input as HTMLInputElement).click()
    }
  }

  return (
    <>
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-10">

        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-rg-dark/40 hover:text-rg-dark transition-colors mb-8"
        >
          <ChevronLeft size={15} />
          Tutti i Campi
        </Link>

        {/* Court header */}
        <div className="mb-8 pb-6 border-b border-rg-dark/10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-rg-dark tracking-tight">{court.name}</h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sm text-rg-dark/50 capitalize">{court.surface_type}</span>
                <span className="text-rg-dark/20">·</span>
                <span className="text-sm text-rg-dark/50">{openTime} – {closeTime}</span>
              </div>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-semibold bg-rg-clay/8 text-rg-clay border border-rg-clay/20 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-rg-clay animate-pulse" />
              {available} slot disponibil{available !== 1 ? 'i' : 'e'}
            </span>
          </div>
        </div>

        {/* ── Date Chips — swipeable ──────────────────────────────────────────── */}
        <div className="mb-8">
          <p className="text-[10px] font-bold text-rg-dark/35 uppercase tracking-widest mb-3">
            Seleziona Data
          </p>

          {/* Scrollable chip row — hides scrollbar, native swipe on mobile */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">

            {chipDates.map(chip => (
              <Link
                key={chip.value}
                href={`/dashboard/court/${court.id}?date=${chip.value}`}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all duration-150 whitespace-nowrap ${
                  date === chip.value
                    ? 'bg-rg-clay border-rg-clay text-white shadow-sm'
                    : 'bg-white border-rg-dark/12 text-rg-dark/55 hover:border-rg-clay/60 hover:text-rg-clay'
                }`}
              >
                {chip.label}
              </Link>
            ))}

            {/* Pick Date chip */}
            <button
              type="button"
              onClick={openDatePicker}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all duration-150 whitespace-nowrap ${
                !isChipDate
                  ? 'bg-rg-clay border-rg-clay text-white shadow-sm'
                  : 'bg-white border-rg-dark/12 text-rg-dark/55 hover:border-rg-clay/60 hover:text-rg-clay'
              }`}
            >
              <Calendar size={13} />
              {!isChipDate
                ? new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' })
                    .format(new Date(`${date}T12:00:00`))
                : 'Scegli Data'}
            </button>

            {/* Hidden date input */}
            <input
              ref={dateInputRef}
              type="date"
              value={date}
              min={today}
              onChange={e => {
                if (e.target.value) router.push(`/dashboard/court/${court.id}?date=${e.target.value}`)
              }}
              className="sr-only"
            />
          </div>
        </div>

        {/* Date label */}
        <p className="text-sm text-rg-dark/40 mb-6 capitalize">{displayDate}</p>

        {/* ── Time-block grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {slots.map(slot => {
            const endTime = addHour(slot.time)

            if (slot.booked) {
              return (
                <div
                  key={slot.time}
                  className="flex flex-col items-center justify-center rounded-xl border border-rg-dark/8 bg-rg-dark/[0.03] py-5 cursor-not-allowed select-none"
                >
                  <span className="text-sm font-bold text-rg-dark/20">{slot.time} – {endTime}</span>
                  <span className="text-[10px] text-rg-dark/20 mt-1 font-medium">Occupato</span>
                </div>
              )
            }
            if (slot.past) {
              return (
                <div
                  key={slot.time}
                  className="flex flex-col items-center justify-center rounded-xl border border-rg-dark/6 bg-rg-dark/[0.02] py-5 cursor-not-allowed select-none opacity-30"
                >
                  <span className="text-sm font-bold text-rg-dark/40">{slot.time} – {endTime}</span>
                  <span className="text-[10px] text-rg-dark/40 mt-1 font-medium">Passato</span>
                </div>
              )
            }
            return (
              <button
                key={slot.time}
                onClick={() => setSelectedSlot(slot.time)}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-rg-clay/40 bg-rg-clay/5 py-5 hover:bg-rg-clay hover:border-rg-clay group transition-all duration-150"
              >
                <span className="text-sm font-bold text-rg-dark group-hover:text-white">{slot.time} – {endTime}</span>
                <span className="text-[10px] text-rg-clay group-hover:text-white/80 mt-1 font-semibold">Prenota</span>
              </button>
            )
          })}
        </div>

      </div>

      {selectedSlot && (
        <SmartBookingModal
          courtId={court.id}
          courtName={court.name}
          preSelectedDate={date}
          preSelectedStartTime={selectedSlot}
          onClose={() => setSelectedSlot(null)}
        />
      )}
    </>
  )
}
