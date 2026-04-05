import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CalendarDays, Clock, MapPin } from 'lucide-react'
import CancelBookingButton from '@/components/ui/CancelBookingButton'

type BookingWithCourt = {
  id: string
  start_time: string
  end_time: string
  status: string
  courts: {
    name: string
    surface_type: string
  } | null
}

function formatBookingTime(start: string, end: string): { date: string; time: string } {
  const s = new Date(start)
  const e = new Date(end)
  const date  = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(s)
  const startT = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false }).format(s)
  const endT   = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false }).format(e)
  return { date, time: `${startT} – ${endT}` }
}

export default async function MyBookingsPage() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, start_time, end_time, status, courts(name, surface_type)')
    .eq('user_id', authUser.id)
    .order('start_time', { ascending: true })
    .returns<BookingWithCourt[]>()

  const upcoming = bookings?.filter(b => new Date(b.end_time) >= new Date()) ?? []
  const past     = bookings?.filter(b => new Date(b.end_time) <  new Date()) ?? []

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">

      {/* Page header */}
      <div className="mb-10 pb-8 border-b border-rg-dark/10">
        <h1 className="text-3xl font-bold text-rg-dark tracking-tight">Le Mie Prenotazioni</h1>
        <p className="text-rg-dark/50 mt-2">
          {upcoming.length > 0
            ? `Hai ${upcoming.length} prenotazion${upcoming.length !== 1 ? 'i' : 'e'} in arrivo.`
            : 'Nessuna prenotazione imminente. Vai su Campi per prenotare uno slot.'}
        </p>
      </div>

      {/* Upcoming */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-[10px] font-bold text-rg-dark/35 uppercase tracking-widest">Prossime</h2>
          {upcoming.length > 0 && (
            <span className="text-[10px] font-bold bg-rg-clay/10 text-rg-clay px-2 py-0.5 rounded-full">
              {upcoming.length}
            </span>
          )}
        </div>

        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 rounded-2xl border-2 border-dashed border-rg-dark/10 text-center">
            <div className="w-12 h-12 rounded-full bg-rg-dark/5 flex items-center justify-center mb-3">
              <CalendarDays size={20} className="text-rg-dark/30" />
            </div>
            <p className="text-sm font-medium text-rg-dark/50">Nessuna prenotazione imminente</p>
            <p className="text-xs text-rg-dark/35 mt-1">
              Vai su <span className="text-rg-clay font-semibold">Campi</span> per prenotare uno slot.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {upcoming.map(b => <BookingTicket key={b.id} booking={b} showCancel />)}
          </div>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-[10px] font-bold text-rg-dark/35 uppercase tracking-widest">Passate</h2>
            <span className="text-[10px] font-bold bg-rg-dark/8 text-rg-dark/40 px-2 py-0.5 rounded-full">
              {past.length}
            </span>
          </div>
          <div className="flex flex-col gap-3 opacity-50">
            {past.map(b => <BookingTicket key={b.id} booking={b} showCancel={false} />)}
          </div>
        </section>
      )}
    </main>
  )
}

function BookingTicket({ booking, showCancel }: { booking: BookingWithCourt; showCancel: boolean }) {
  const { date, time } = formatBookingTime(booking.start_time, booking.end_time)
  const courtName = booking.courts?.name ?? 'Unknown Court'
  const surface   = booking.courts?.surface_type ?? ''

  const stripeColor =
    booking.status === 'confirmed' ? 'bg-rg-clay' :
    booking.status === 'cancelled' ? 'bg-rg-dark/20' :
    'bg-rg-olive'

  const badgeClass =
    booking.status === 'confirmed' ? 'bg-rg-clay/10 text-rg-clay border border-rg-clay/20' :
    booking.status === 'cancelled' ? 'bg-rg-dark/6 text-rg-dark/40 border border-rg-dark/10' :
    'bg-rg-olive/15 text-rg-olive border border-rg-olive/30'

  const badgeLabel =
    booking.status === 'confirmed' ? 'Confermata' :
    booking.status === 'cancelled' ? 'Annullata' :
    'In attesa'

  return (
    <div className="bg-white border border-rg-dark/8 rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex">
      {/* Accent stripe */}
      <div className={`w-1 flex-shrink-0 ${stripeColor}`} />

      <div className="flex flex-1 items-center justify-between gap-4 px-5 py-4">
        {/* Left: details */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="font-bold text-rg-dark text-base truncate">{courtName}</span>
          <div className="flex flex-wrap items-center gap-3 text-sm text-rg-dark/50">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={13} className="text-rg-dark/30" />
              {date}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={13} className="text-rg-dark/30" />
              {time}
            </span>
            {surface && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13} className="text-rg-dark/30" />
                <span className="capitalize">{surface}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: badge + cancel */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${badgeClass}`}>
            {badgeLabel}
          </span>
          {showCancel && booking.status === 'confirmed' && (
            <CancelBookingButton bookingId={booking.id} />
          )}
        </div>
      </div>
    </div>
  )
}
