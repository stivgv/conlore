import Link from 'next/link'

// 30-min slots 08:00 – 23:30 (31 entries)
const SLOTS = Array.from({ length: 31 }, (_, i) => {
  const t = 8 * 60 + i * 30
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
})

export type ScheduleCourt   = { id: string; name: string; open_time: string; close_time: string }
export type ScheduleBooking = { id: string; court_id: string; start_time: string; end_time: string }

function isSlotBooked(booking: ScheduleBooking, courtId: string, slotStart: Date): boolean {
  if (booking.court_id !== courtId) return false
  const bStart  = new Date(booking.start_time)
  const bEnd    = new Date(booking.end_time)
  const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000)
  return bStart < slotEnd && bEnd > slotStart
}

/** A slot is applicable only if its minute matches the court's opening minute,
 *  and it falls within the court's open/close range. */
function isSlotApplicable(court: ScheduleCourt, slot: string): boolean {
  const [slotH, slotM]   = slot.split(':').map(Number)
  const [openH, openM]   = court.open_time.split(':').map(Number)
  const [closeH, closeM] = court.close_time.split(':').map(Number)
  const slotTotal  = slotH * 60 + slotM
  const openTotal  = openH * 60 + openM
  const closeTotal = closeH * 60 + closeM
  return slotM === openM && slotTotal >= openTotal && slotTotal < closeTotal
}

interface GlobalScheduleGridProps {
  courts:   ScheduleCourt[]
  bookings: ScheduleBooking[]
  date:     string          // YYYY-MM-DD
}

export default function GlobalScheduleGrid({ courts, bookings, date }: GlobalScheduleGridProps) {
  const now = new Date()

  if (courts.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-rg-dark/40">
        Nessun campo attivo da visualizzare.
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-rg-dark/12 shadow-sm">
      <table className="w-full text-xs border-collapse">

        {/* ── Header ─────────────────────────────────────────── */}
        <thead>
          <tr style={{ background: '#311815' }}>
            <th className="px-3 py-2.5 text-left text-[10px] font-bold text-white/40 uppercase tracking-widest w-14 border-r border-white/8">
              Ora
            </th>
            {courts.map(court => (
              <th key={court.id} className="px-3 py-2.5 text-left text-[10px] font-bold text-white uppercase tracking-wider border-r border-white/8 last:border-r-0">
                {court.name}
              </th>
            ))}
          </tr>
        </thead>

        {/* ── Body ───────────────────────────────────────────── */}
        <tbody>
          {SLOTS.map((slot, rowIdx) => {
            const slotStart   = new Date(`${date}T${slot}:00`)
            const isOnTheHour = slot.endsWith(':00')
            const bandEven    = Math.floor(rowIdx / 2) % 2 === 0

            return (
              <tr
                key={slot}
                className={`${bandEven ? 'bg-white' : 'bg-rg-dark/[0.03]'} ${isOnTheHour && rowIdx > 0 ? 'border-t border-rg-dark/10' : ''}`}
              >
                {/* Time label */}
                <td className={`px-3 py-1 font-bold border-r border-rg-dark/8 w-14 whitespace-nowrap select-none ${isOnTheHour ? 'text-rg-dark' : 'text-rg-dark/20'}`}>
                  {slot}
                </td>

                {/* Court cells */}
                {courts.map(court => {
                  const applicable = isSlotApplicable(court, slot)
                  if (!applicable) {
                    return (
                      <td key={court.id} className="px-1 py-0.5 border-r border-rg-dark/6 last:border-r-0">
                        <span className="flex items-center justify-center rounded py-0.5 px-2 text-[10px] text-rg-dark/15 select-none">
                          —
                        </span>
                      </td>
                    )
                  }

                  const isPast = slotStart < now
                  if (isPast) {
                    return (
                      <td key={court.id} className="px-1 py-0.5 border-r border-rg-dark/6 last:border-r-0 opacity-30 bg-rg-dark/[0.02]">
                        <span className="flex items-center justify-center rounded py-0.5 px-2 text-[10px] text-rg-dark/30 select-none">
                          Passato
                        </span>
                      </td>
                    )
                  }

                  const booked = bookings.some(b => isSlotBooked(b, court.id, slotStart))
                  return (
                    <td key={court.id} className="px-1 py-0.5 border-r border-rg-dark/6 last:border-r-0">
                      {booked ? (
                        <span className="flex items-center justify-center rounded bg-rg-dark/10 text-rg-dark/25 font-bold py-0.5 px-2 cursor-not-allowed select-none text-[10px]">
                          ●
                        </span>
                      ) : (
                        <Link
                          href={`/dashboard/court/${court.id}?date=${date}`}
                          className="flex items-center justify-center rounded font-bold py-0.5 px-2 text-[10px] text-rg-clay hover:bg-rg-clay hover:text-white transition-colors duration-100"
                        >
                          ✓
                        </Link>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
