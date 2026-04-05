import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Court, User } from '@/types/database'
import CourtCard from '@/components/CourtCard'
import GlobalScheduleGrid, { type ScheduleBooking } from '@/components/GlobalScheduleGrid'

function offsetDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d + days).toLocaleDateString('en-CA')
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const today = new Date().toLocaleDateString('en-CA')

  const [profileResult, courtsResult, bookingsResult] = await Promise.all([
    supabase
      .from('users')
      .select('role, name, email')
      .eq('id', authUser.id)
      .single<Pick<User, 'role' | 'name' | 'email'>>(),
    supabase
      .from('courts')
      .select('id, name, surface_type, is_active, open_time, close_time')
      .eq('is_active', true)
      .order('name')
      .returns<Court[]>(),
    supabase
      .from('bookings')
      .select('id, court_id, start_time, end_time')
      .eq('status', 'confirmed')
      .gte('start_time', `${today}T00:00:00`)
      .lt('start_time',  `${offsetDate(today, 1)}T00:00:00`)
      .returns<ScheduleBooking[]>(),
  ])

  const profile     = profileResult.data
  const courts      = courtsResult.data  ?? []
  const bookings    = bookingsResult.data ?? []
  const displayName = profile?.name || profile?.email || authUser.email || 'Player'
  const isAdmin     = profile?.role === 'admin'

  const todayLabel = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date())

  return (
    <main className="min-h-screen bg-white">
    <div className="max-w-7xl mx-auto px-6 py-10">

      {/* Hero */}
      <div className="mb-12 pb-8 border-b border-rg-dark/10">
        <p className="text-sm font-medium text-rg-clay mb-1">{todayLabel}</p>
        <h1 className="text-3xl font-bold text-rg-dark tracking-tight">
          Bentornato, {isAdmin ? 'Admin' : displayName} 👋
        </h1>
        <p className="text-rg-dark/50 mt-2 text-base">
          {courts.length > 0
            ? `${courts.length} camp${courts.length !== 1 ? 'i' : 'o'} disponibil${courts.length !== 1 ? 'i' : 'e'} — seleziona un campo per vedere gli orari e prenotare.`
            : 'Nessun campo disponibile al momento.'}
        </p>
      </div>

      {/* ── Master Cards ───────────────────────────────────────────────────── */}
      {courts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-rg-dark/8 flex items-center justify-center mb-4">
            <span className="text-3xl">🎾</span>
          </div>
          <p className="text-rg-dark/50 font-medium">Nessun campo attivo trovato.</p>
          {isAdmin && (
            <p className="text-sm text-rg-dark/35 mt-1">Aggiungi campi dal pannello Supabase.</p>
          )}
        </div>
      ) : (
        <div className="flex justify-center mb-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl justify-items-center">
            {courts.map((court) => (
              <CourtCard key={court.id} court={court} />
            ))}
          </div>
        </div>
      )}

      {/* ── Today's Overview ───────────────────────────────────────────────── */}
      {courts.length > 0 && (
        <section>
          <div className="flex items-end justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-rg-dark tracking-tight">Panoramica: Tutti i Campi</h2>
              <p className="text-sm text-rg-dark/45 mt-0.5 capitalize">{todayLabel}</p>
            </div>
            <span className="text-xs font-semibold text-rg-clay border border-rg-clay/30 bg-rg-clay/5 px-3 py-1.5 rounded-full">
              Oggi
            </span>
          </div>
          <GlobalScheduleGrid courts={courts} bookings={bookings} date={today} />
        </section>
      )}

    </div>
    </main>
  )
}
