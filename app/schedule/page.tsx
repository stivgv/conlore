import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import GlobalScheduleGrid, { type ScheduleCourt, type ScheduleBooking } from '@/components/GlobalScheduleGrid'

function offsetDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d + days).toLocaleDateString('en-CA')
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const params = await searchParams
  const today  = new Date().toLocaleDateString('en-CA')
  const date   = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date! : today

  const prevDay = offsetDate(date, -1)
  const nextDay = offsetDate(date, +1)

  const [courtsResult, bookingsResult] = await Promise.all([
    supabase
      .from('courts')
      .select('id, name, open_time, close_time')
      .eq('is_active', true)
      .order('name')
      .returns<ScheduleCourt[]>(),
    supabase
      .from('bookings')
      .select('id, court_id, start_time, end_time')
      .eq('status', 'confirmed')
      .gte('start_time', `${date}T00:00:00`)
      .lt('start_time',  `${offsetDate(date, 1)}T00:00:00`)
      .returns<ScheduleBooking[]>(),
  ])

  const courts   = courtsResult.data  ?? []
  const bookings = bookingsResult.data ?? []

  const isToday = date === today
  const displayDate = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))

  return (
    <main className="min-h-screen bg-white">
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10">

      {/* Page header */}
      <div className="mb-8 pb-8 border-b border-rg-dark/10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-rg-clay mb-1">Disponibilità Campi</p>
          <h1 className="text-3xl font-bold text-rg-dark tracking-tight">Orario</h1>
          <p className="text-rg-dark/45 mt-1 text-sm capitalize">{displayDate}</p>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <Link
            href={`/schedule?date=${prevDay}`}
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-rg-dark/15 text-rg-dark/40 hover:text-rg-dark hover:bg-rg-dark/5 hover:border-rg-dark/30 transition-all"
          >
            <ChevronLeft size={16} />
          </Link>

          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-rg-dark/12 min-w-[160px] justify-center">
            <span className="text-sm font-semibold text-rg-dark">
              {isToday ? 'Oggi' : new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))}
            </span>
            {!isToday && (
              <Link href="/schedule" className="text-xs text-rg-clay hover:text-rg-dark font-medium transition-colors">
                (Oggi)
              </Link>
            )}
          </div>

          <Link
            href={`/schedule?date=${nextDay}`}
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-rg-dark/15 text-rg-dark/40 hover:text-rg-dark hover:bg-rg-dark/5 hover:border-rg-dark/30 transition-all"
          >
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      {/* Grid */}
      <GlobalScheduleGrid courts={courts} bookings={bookings} date={date} />

    </div>
    </main>
  )
}
