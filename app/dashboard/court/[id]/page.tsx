import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CourtScheduleClient, { type SlotData, type DateChip } from '@/components/CourtScheduleClient'

type CourtDetail = {
  id: string
  name: string
  surface_type: string
  open_time: string
  close_time: string
}

type BookingRow = {
  id: string
  start_time: string
  end_time: string
}

/** YYYY-MM-DD string offset by N days, no UTC drift */
function offsetDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d + days).toLocaleDateString('en-CA')
}

/** Generate 1-hour slot labels from court open/close times, preserving minutes (:00 or :30) */
function generateSlots(openTime: string, closeTime: string): string[] {
  const [openH, openM]   = openTime.split(':').map(Number)
  const [closeH, closeM] = closeTime.split(':').map(Number)
  const openMins  = openH * 60 + openM
  const closeMins = closeH * 60 + closeM
  const slots: string[] = []
  for (let t = openMins; t < closeMins; t += 60) {
    slots.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`)
  }
  return slots
}

/** True if any confirmed booking overlaps the 1-hour slot starting at slotStart */
function isBooked(slotStart: Date, bookings: BookingRow[]): boolean {
  const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000)
  return bookings.some(b =>
    new Date(b.start_time) < slotEnd && new Date(b.end_time) > slotStart
  )
}

export default async function CourtPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { id } = await params
  const sp      = await searchParams
  const today   = new Date().toLocaleDateString('en-CA')
  const date    = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date! : today

  // Build 5 quick-select date chips: Today, Tomorrow, +2, +3, +4
  const chipDates: DateChip[] = Array.from({ length: 5 }, (_, i) => {
    const value = offsetDate(today, i)
    const label = i === 0 ? 'Oggi'
      : i === 1 ? 'Domani'
      : new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric' })
          .format(new Date(`${value}T12:00:00`))
    return { label, value }
  })

  // Fetch court
  const { data: court } = await supabase
    .from('courts')
    .select('id, name, surface_type, open_time, close_time')
    .eq('id', id)
    .eq('is_active', true)
    .single<CourtDetail>()

  if (!court) redirect('/dashboard')

  // Fetch confirmed bookings for this court on the selected date
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, start_time, end_time')
    .eq('court_id', court.id)
    .eq('status', 'confirmed')
    .gte('start_time', `${date}T00:00:00`)
    .lt('start_time',  `${offsetDate(date, 1)}T00:00:00`)
    .returns<BookingRow[]>()

  const rawBookings = bookings ?? []
  const now         = new Date()

  // Build slot data
  const slots: SlotData[] = generateSlots(court.open_time, court.close_time).map(time => {
    const slotStart = new Date(`${date}T${time}:00`)
    return {
      time,
      booked: isBooked(slotStart, rawBookings),
      past:   slotStart < now,
    }
  })

  return (
    <CourtScheduleClient
      court={court}
      slots={slots}
      date={date}
      today={today}
      chipDates={chipDates}
    />
  )
}
